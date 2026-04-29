import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratedTestCasePrompt } from './entities/generated-test-case-prompt.entity';
import { ProjectsService } from '../projects/projects.service';
import { LlmService } from './llm/llm.service';
import { buildTestCasePrompt } from './prompt-builder';

export interface TestCaseRecord {
  id: string;
  projectId: string;
  promptText: string;
  generatedResult: string | null;
  createdAt: Date;
}

@Injectable()
export class TestCasesService {
  constructor(
    @InjectRepository(GeneratedTestCasePrompt)
    private readonly repo: Repository<GeneratedTestCasePrompt>,
    private readonly projectsSvc: ProjectsService,
    private readonly llm: LlmService,
  ) {}

  async generate(
    projectId: string,
    ownerId: string,
  ): Promise<TestCaseRecord> {
    const project = await this.projectsSvc.findOneOwned(projectId, ownerId);
    const promptText = buildTestCasePrompt({
      name: project.name,
      url: project.url,
      description: project.description ?? null,
      targetUsername: project.targetUsername,
    });
    const generatedResult = await this.llm.tryGenerate(promptText);

    const saved = await this.repo.save(
      this.repo.create({ projectId, promptText, generatedResult }),
    );
    return this.toRecord(saved);
  }

  async getLatest(
    projectId: string,
    ownerId: string,
  ): Promise<TestCaseRecord | null> {
    await this.projectsSvc.findEntityOwnedOrThrow(projectId, ownerId);
    const row = await this.repo.findOne({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toRecord(row) : null;
  }

  private toRecord(p: GeneratedTestCasePrompt): TestCaseRecord {
    return {
      id: p.id,
      projectId: p.projectId,
      promptText: p.promptText,
      generatedResult: p.generatedResult ?? null,
      createdAt: p.createdAt,
    };
  }
}
