import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeneratedTestCasePrompt } from './entities/generated-test-case-prompt.entity';
import { TestCasesController } from './test-cases.controller';
import { TestCasesService } from './test-cases.service';
import { LlmService } from './llm/llm.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GeneratedTestCasePrompt]),
    ProjectsModule,
  ],
  controllers: [TestCasesController],
  providers: [TestCasesService, LlmService],
  exports: [TestCasesService, TypeOrmModule],
})
export class TestCasesModule {}
