import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ChildProcess, spawn } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import { CrawlRun } from './entities/crawl-run.entity';
import { Project } from '../projects/entities/project.entity';
import { UiNode } from '../ui-graph/entities/ui-node.entity';
import { UiEdge } from '../ui-graph/entities/ui-edge.entity';
import { ProjectsService } from '../projects/projects.service';
import { decryptSecret } from '../common/utils/crypto.util';
import { validateTargetUrl, InvalidTargetUrlError } from './url-validator';
import { renderCrawlScript } from './template-renderer';
import {
  RawCrawlOutput,
  transformRawCrawl,
} from './raw-transformer';

const DEFAULT_MAX_DURATION_MS = 5 * 60 * 1000; // hard cap: 5 minutes per run

@Injectable()
export class CrawlerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CrawlerService.name);

  // Track running children so we can kill them on timeout / project shutdown.
  private readonly running = new Map<string, ChildProcess>();

  constructor(
    @InjectRepository(CrawlRun)
    private readonly runs: Repository<CrawlRun>,
    @InjectRepository(Project)
    private readonly projectsRepo: Repository<Project>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly projectsSvc: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  // On startup, fail any rows that are stuck in queued/running. They're zombies
  // from a previous BE process that died mid-crawl, and they'd otherwise block
  // the user with a 409 forever.
  async onApplicationBootstrap(): Promise<void> {
    const orphans = await this.runs.find({
      where: [{ status: 'queued' }, { status: 'running' }],
    });
    if (orphans.length === 0) return;
    this.logger.warn(`Recovering ${orphans.length} orphan crawl run(s) from previous shutdown`);
    for (const r of orphans) {
      r.status = 'failed';
      r.errorMessage = 'Recovered after backend restart (run was orphaned)';
      r.finishedAt = new Date();
      await this.runs.save(r);
      const proj = await this.projectsRepo.findOne({ where: { id: r.projectId } });
      if (proj && proj.status === 'crawling') {
        proj.status = 'failed';
        await this.projectsRepo.save(proj);
      }
    }
  }

  private get storageRoot(): string {
    return join(process.cwd(), 'storage', 'projects');
  }

  private get maxDurationMs(): number {
    const raw = this.config.get<string | number>('CRAWLER_MAX_DURATION_MS');
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_DURATION_MS;
  }

  async startCrawl(projectId: string, ownerId: string): Promise<CrawlRun> {
    const project = await this.projectsSvc.findEntityOwnedOrThrow(
      projectId,
      ownerId,
    );

    const inFlight = await this.runs.findOne({
      where: [
        { projectId, status: 'queued' },
        { projectId, status: 'running' },
      ],
    });
    if (inFlight) {
      throw new ConflictException('A crawl run is already in progress');
    }

    const dir = join(this.storageRoot, projectId);
    const screenshotsDir = join(dir, 'screenshots');
    const logsDir = join(dir, 'logs');
    mkdirSync(dir, { recursive: true });
    mkdirSync(screenshotsDir, { recursive: true });
    mkdirSync(logsDir, { recursive: true });

    const run = this.runs.create({
      projectId,
      status: 'queued',
      startedAt: new Date(),
      scriptPath: '',
      rawDataPath: '',
    });
    const saved = await this.runs.save(run);

    const scriptPath = join(dir, `crawl-${saved.id}.ts`);
    const rawDataPath = join(dir, `raw-${saved.id}.json`);
    const logPath = join(logsDir, `run-${saved.id}.log`);
    saved.scriptPath = scriptPath;
    saved.rawDataPath = rawDataPath;
    await this.runs.save(saved);

    project.status = 'crawling';
    await this.projectsRepo.save(project);

    // Run async — do not block the HTTP response.
    void this.executeRun(saved, project, scriptPath, rawDataPath, screenshotsDir, logPath);

    return saved;
  }

  async cancelRun(
    projectId: string,
    runId: string,
    ownerId: string,
  ): Promise<CrawlRun> {
    const run = await this.getRun(projectId, runId, ownerId);
    if (run.status === 'success' || run.status === 'failed') {
      return run;
    }
    const child = this.running.get(runId);
    if (child) {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      this.running.delete(runId);
    }
    run.status = 'failed';
    run.errorMessage = 'Cancelled by user';
    run.finishedAt = new Date();
    await this.runs.save(run);
    const proj = await this.projectsRepo.findOne({ where: { id: projectId } });
    if (proj) {
      proj.status = 'failed';
      await this.projectsRepo.save(proj);
    }
    return run;
  }

  private async executeRun(
    run: CrawlRun,
    project: Project,
    scriptPath: string,
    rawDataPath: string,
    screenshotsDir: string,
    logPath: string,
  ): Promise<void> {
    let timedOut = false;
    try {
      // 1. Validate URL
      await validateTargetUrl(project.url);

      // 2. Decrypt password (the ONLY caller of decryptSecret).
      const password = decryptSecret(project.targetPasswordEncrypted);

      // 3. Render script.
      const maxDuration = this.maxDurationMs;
      const source = renderCrawlScript({
        url: project.url,
        username: project.targetUsername,
        password,
        maxDepth: Number(this.config.get('CRAWLER_MAX_DEPTH') ?? 3),
        maxPages: Number(this.config.get('CRAWLER_MAX_PAGES') ?? 50),
        timeoutMs: Number(this.config.get('CRAWLER_TIMEOUT_MS') ?? 60000),
        outputJsonPath: rawDataPath,
        screenshotsDir,
        // Inside the script, stop the BFS once we exceed this many ms total.
        // We give the script a slightly tighter budget than the parent so it
        // has time to flush its raw JSON before the parent's hard kill fires.
        maxDurationMs: Math.max(10_000, maxDuration - 5_000),
      });
      writeFileSync(scriptPath, source, 'utf8');

      // 4. Mark running.
      run.status = 'running';
      await this.runs.save(run);

      // 5. Spawn `node -r ts-node/register <scriptPath>` with a hard timeout.
      const exitCode = await new Promise<number>((resolve) => {
        const child = spawn(
          process.execPath,
          ['-r', 'ts-node/register', scriptPath],
          {
            cwd: process.cwd(),
            env: { ...process.env, VERIFAI_OUTPUT_JSON: rawDataPath },
          },
        );
        this.running.set(run.id, child);

        const log = createWriteStream(logPath, { flags: 'a' });
        log.write(`[crawler] starting child PID=${child.pid} maxDurationMs=${maxDuration}\n`);
        child.stdout.pipe(log);
        child.stderr.pipe(log);

        const killTimer = setTimeout(() => {
          timedOut = true;
          log.write(`[crawler] timeout after ${maxDuration}ms — killing PID=${child.pid}\n`);
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore
          }
        }, maxDuration);

        child.on('exit', (code) => {
          clearTimeout(killTimer);
          this.running.delete(run.id);
          resolve(code ?? 1);
        });
        child.on('error', (err) => {
          clearTimeout(killTimer);
          this.running.delete(run.id);
          log.write(`[crawler] spawn error: ${err.message}\n`);
          resolve(1);
        });
      });

      if (timedOut) {
        // The script may have flushed partial JSON before being killed; try to
        // ingest whatever it managed to produce.
        if (existsSync(rawDataPath)) {
          try {
            await this.ingestRawJson(run, rawDataPath);
            run.status = 'failed';
            run.errorMessage = `Crawl timed out after ${Math.round(this.maxDurationMs / 1000)}s — partial graph ingested`;
            run.finishedAt = new Date();
            await this.runs.save(run);
            project.status = 'failed';
            await this.projectsRepo.save(project);
            return;
          } catch {
            // fall through to plain timeout failure
          }
        }
        throw new Error(`Crawl timed out after ${Math.round(this.maxDurationMs / 1000)}s`);
      }

      if (exitCode !== 0) {
        throw new Error(`Crawl script exited with code ${exitCode}`);
      }

      // 6. Read + transform + persist.
      const loginDiag = await this.ingestRawJson(run, rawDataPath);

      // If the script reports the login failed, mark run as failed with a clear
      // message — the user otherwise sees only the login + forgot-pass nodes.
      if (loginDiag && loginDiag.attempted && !loginDiag.succeeded) {
        run.status = 'failed';
        run.errorMessage = `Login failed: ${loginDiag.reason ?? 'unknown reason'} (urlBefore=${loginDiag.urlBefore}, urlAfter=${loginDiag.urlAfter})`;
        run.finishedAt = new Date();
        await this.runs.save(run);
        project.status = 'failed';
        await this.projectsRepo.save(project);
        return;
      }

      run.status = 'success';
      run.finishedAt = new Date();
      await this.runs.save(run);
      project.status = 'crawled';
      await this.projectsRepo.save(project);
    } catch (err) {
      const message =
        err instanceof InvalidTargetUrlError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(`Crawl ${run.id} failed: ${message}`);
      run.status = 'failed';
      run.errorMessage = message;
      run.finishedAt = new Date();
      await this.runs.save(run);
      project.status = 'failed';
      await this.projectsRepo.save(project);
    }
  }

  private async ingestRawJson(
    run: CrawlRun,
    rawDataPath: string,
  ): Promise<RawCrawlOutput['loginDiag'] | undefined> {
    const rawJson = readFileSync(rawDataPath, 'utf8');
    const raw = JSON.parse(rawJson) as RawCrawlOutput;
    const transformed = transformRawCrawl(raw);

    await this.dataSource.transaction(async (mgr) => {
      const nodeMap = new Map<string, UiNode>();
      for (const n of transformed.nodes) {
        const node = mgr.create(UiNode, {
          projectId: run.projectId,
          crawlRunId: run.id,
          url: n.url,
          title: n.title,
          metadata: n.metadata,
        });
        const saved = await mgr.save(UiNode, node);
        nodeMap.set(n.url, saved);
      }
      for (const n of transformed.nodes) {
        if (n.parentUrl && nodeMap.has(n.parentUrl)) {
          const child = nodeMap.get(n.url)!;
          child.parentNodeId = nodeMap.get(n.parentUrl)!.id;
          await mgr.save(UiNode, child);
        }
      }
      for (const e of transformed.edges) {
        const from = nodeMap.get(e.fromUrl);
        const to = nodeMap.get(e.toUrl);
        if (!from || !to) continue;
        const edge = mgr.create(UiEdge, {
          crawlRunId: run.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          triggerLabel: e.triggerLabel,
          metadata: {},
        });
        await mgr.save(UiEdge, edge);
      }
    });

    return raw.loginDiag;
  }

  async listRuns(projectId: string, ownerId: string): Promise<CrawlRun[]> {
    await this.projectsSvc.findEntityOwnedOrThrow(projectId, ownerId);
    return this.runs.find({
      where: { projectId },
      order: { startedAt: 'DESC' },
    });
  }

  async getRun(
    projectId: string,
    runId: string,
    ownerId: string,
  ): Promise<CrawlRun> {
    await this.projectsSvc.findEntityOwnedOrThrow(projectId, ownerId);
    const run = await this.runs.findOne({ where: { id: runId, projectId } });
    if (!run) throw new NotFoundException('Crawl run not found');
    return run;
  }

  screenshotPathFor(projectId: string, hash: string): string {
    return join(this.storageRoot, projectId, 'screenshots', `${hash}.png`);
  }

  // Kept so future filters by run-id list can be added without re-import churn.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _keep = In;
}
