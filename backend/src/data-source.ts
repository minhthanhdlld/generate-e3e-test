import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { User } from './users/entities/user.entity';
import { Project } from './projects/entities/project.entity';
import { CrawlRun } from './crawler/entities/crawl-run.entity';
import { UiNode } from './ui-graph/entities/ui-node.entity';
import { UiEdge } from './ui-graph/entities/ui-edge.entity';
import { GeneratedTestCasePrompt } from './test-cases/entities/generated-test-case-prompt.entity';

loadEnv();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'verifai_app',
  password: process.env.DB_PASSWORD ?? 'verifai_app_local',
  database: process.env.DB_NAME ?? 'verifai',
  entities: [User, Project, CrawlRun, UiNode, UiEdge, GeneratedTestCasePrompt],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  logging: ['error', 'warn'],
});
