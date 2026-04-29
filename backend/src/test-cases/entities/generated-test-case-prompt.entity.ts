import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity('generated_test_case_prompts')
@Index(['projectId', 'createdAt'])
export class GeneratedTestCasePrompt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project!: Project;

  @Column('uuid')
  projectId!: string;

  @Column({ type: 'text' })
  promptText!: string;

  @Column({ type: 'text', nullable: true })
  generatedResult?: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
