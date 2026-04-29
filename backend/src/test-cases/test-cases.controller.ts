import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUserPayload } from '../common/decorators/current-user.decorator';
import { TestCasesService } from './test-cases.service';

@Controller('projects/:projectId/test-cases')
export class TestCasesController {
  constructor(private readonly testCases: TestCasesService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.testCases.generate(projectId, user.sub);
  }

  @Get('latest')
  latest(
    @CurrentUser() user: JwtUserPayload,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.testCases.getLatest(projectId, user.sub);
  }
}
