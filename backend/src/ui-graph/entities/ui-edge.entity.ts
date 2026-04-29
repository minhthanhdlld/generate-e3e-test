import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrawlRun } from '../../crawler/entities/crawl-run.entity';
import { UiNode } from './ui-node.entity';

@Entity('ui_edges')
@Index(['crawlRunId'])
export class UiEdge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => CrawlRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crawlRunId' })
  crawlRun!: CrawlRun;

  @Column('uuid')
  crawlRunId!: string;

  @ManyToOne(() => UiNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromNodeId' })
  fromNode!: UiNode;

  @Column('uuid')
  fromNodeId!: string;

  @ManyToOne(() => UiNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toNodeId' })
  toNode!: UiNode;

  @Column('uuid')
  toNodeId!: string;

  @Column({ type: 'varchar' })
  triggerLabel!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
