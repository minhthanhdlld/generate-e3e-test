import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { CrawlerService } from './crawler.service';
import { existsSync, createReadStream } from 'fs';
import type { Response } from 'express';

@Controller('projects/:projectId')
export class CrawlerController {
  constructor(private readonly crawler: CrawlerService) {}

  @Post('crawl')
  @HttpCode(HttpStatus.ACCEPTED)
  async startCrawl(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    const run = await this.crawler.startCrawl(projectId, user.sub);
    return { id: run.id, status: run.status, startedAt: run.startedAt };
  }

  @Get('crawls')
  listRuns(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.crawler.listRuns(projectId, user.sub);
  }

  @Get('crawls/:runId')
  getRun(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ) {
    return this.crawler.getRun(projectId, runId, user.sub);
  }

  @Post('crawls/:runId/cancel')
  cancelRun(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('runId', new ParseUUIDPipe()) runId: string,
  ) {
    return this.crawler.cancelRun(projectId, runId, user.sub);
  }

  @Get('screenshots/:hash')
  @Header('Content-Type', 'image/png')
  async screenshot(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('hash') hash: string,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<StreamableFile> {
    if (!/^[a-f0-9]{40}$/i.test(hash)) {
      throw new NotFoundException('Screenshot not found');
    }
    // Owner check via crawler (loads project ownership before serving).
    await this.crawler.listRuns(projectId, user.sub);
    const path = this.crawler.screenshotPathFor(projectId, hash);
    if (!existsSync(path)) throw new NotFoundException('Screenshot not found');
    return new StreamableFile(createReadStream(path));
  }
}
