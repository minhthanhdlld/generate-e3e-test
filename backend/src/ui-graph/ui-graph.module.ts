import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UiNode } from './entities/ui-node.entity';
import { UiEdge } from './entities/ui-edge.entity';
import { CrawlRun } from '../crawler/entities/crawl-run.entity';
import { UiGraphController } from './ui-graph.controller';
import { UiGraphService } from './ui-graph.service';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UiNode, UiEdge, CrawlRun]),
    ProjectsModule,
  ],
  controllers: [UiGraphController],
  providers: [UiGraphService],
  exports: [UiGraphService, TypeOrmModule],
})
export class UiGraphModule {}
