import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { CrawlRun } from '../../crawler/entities/crawl-run.entity';

@Entity('ui_nodes')
@Unique('UQ_ui_nodes_crawlRun_url', ['crawlRunId', 'url'])
@Index(['crawlRunId'])
export class UiNode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column('uuid')
  projectId!: string;

  @ManyToOne(() => CrawlRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crawlRunId' })
  crawlRun!: CrawlRun;

  @Column('uuid')
  crawlRunId!: string;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar', nullable: true })
  title?: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentNodeId?: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
