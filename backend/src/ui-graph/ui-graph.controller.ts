import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { UiGraphService } from './ui-graph.service';

@Controller('projects/:projectId/graph')
export class UiGraphController {
  constructor(private readonly graph: UiGraphService) {}

  @Get()
  get(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('runId') runId?: string,
  ) {
    return this.graph.getGraph(projectId, user.sub, runId);
  }
}
