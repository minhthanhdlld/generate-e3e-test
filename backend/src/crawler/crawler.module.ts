import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlRun } from './entities/crawl-run.entity';
import { Project } from '../projects/entities/project.entity';
import { UiNode } from '../ui-graph/entities/ui-node.entity';
import { UiEdge } from '../ui-graph/entities/ui-edge.entity';
import { CrawlerController } from './crawler.controller';
import { CrawlerService } from './crawler.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CrawlRun, Project, UiNode, UiEdge]),
    ProjectsModule,
  ],
  controllers: [CrawlerController],
  providers: [CrawlerService],
  exports: [CrawlerService, TypeOrmModule],
})
export class CrawlerModule {}
