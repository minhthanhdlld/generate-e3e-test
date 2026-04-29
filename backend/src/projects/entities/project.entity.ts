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
import { User } from '../../users/entities/user.entity';

export type ProjectStatus = 'created' | 'crawling' | 'crawled' | 'failed';

@Entity('projects')
@Index(['ownerId', 'updatedAt'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column('uuid')
  ownerId!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar' })
  url!: string;

  @Column({ type: 'varchar' })
  targetUsername!: string;

  @Column({ type: 'text' })
  targetPasswordEncrypted!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description?: string | null;

  @Column({
    type: 'enum',
    enum: ['created', 'crawling', 'crawled', 'failed'],
    default: 'created',
  })
  status!: ProjectStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
