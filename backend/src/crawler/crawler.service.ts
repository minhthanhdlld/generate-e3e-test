import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { spawn } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
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

@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

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

  private get storageRoot(): string {
    return join(process.cwd(), 'storage', 'projects');
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

  private async executeRun(
    run: CrawlRun,
    project: Project,
    scriptPath: string,
    rawDataPath: string,
    screenshotsDir: string,
    logPath: string,
  ): Promise<void> {
    try {
      // 1. Validate URL
      await validateTargetUrl(project.url);

      // 2. Decrypt password (the ONLY caller of decryptSecret).
      const password = decryptSecret(project.targetPasswordEncrypted);

      // 3. Render script.
      const source = renderCrawlScript({
        url: project.url,
        username: project.targetUsername,
        password,
        maxDepth: Number(this.config.get('CRAWLER_MAX_DEPTH') ?? 3),
        maxPages: Number(this.config.get('CRAWLER_MAX_PAGES') ?? 50),
        timeoutMs: Number(this.config.get('CRAWLER_TIMEOUT_MS') ?? 60000),
        outputJsonPath: rawDataPath,
        screenshotsDir,
      });
      writeFileSync(scriptPath, source, 'utf8');

      // 4. Mark running.
      run.status = 'running';
      await this.runs.save(run);

      // 5. Spawn `node -r ts-node/register <scriptPath>`.
      const exitCode = await new Promise<number>((resolve) => {
        const child = spawn(
          process.execPath,
          ['-r', 'ts-node/register', scriptPath],
          {
            cwd: process.cwd(),
            env: { ...process.env, VERIFAI_OUTPUT_JSON: rawDataPath },
          },
        );
        const log = createWriteStream(logPath, { flags: 'a' });
        child.stdout.pipe(log);
        child.stderr.pipe(log);
        child.on('exit', (code) => resolve(code ?? 1));
      });

      if (exitCode !== 0) {
        throw new Error(`Crawl script exited with code ${exitCode}`);
      }

      // 6. Read + transform + persist.
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
        // self-fk parentNodeId
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

  // Mute "unused" lint on the import — we intentionally keep `In` available for graph fetches.
  // (kept so future filters by run id list can be added without re-import churn)
  private readonly _keep = In;
}
