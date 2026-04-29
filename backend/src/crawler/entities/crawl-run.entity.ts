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
import { Project } from '../../projects/entities/project.entity';

export type CrawlRunStatus = 'queued' | 'running' | 'success' | 'failed';

@Entity('crawl_runs')
@Index(['projectId', 'startedAt'])
export class CrawlRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column('uuid')
  projectId!: string;

  @Column({
    type: 'enum',
    enum: ['queued', 'running', 'success', 'failed'],
    default: 'queued',
  })
  status!: CrawlRunStatus;

  @Column({ type: 'timestamptz' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'varchar' })
  scriptPath!: string;

  @Column({ type: 'varchar' })
  rawDataPath!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
