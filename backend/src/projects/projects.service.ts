import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { rm } from 'fs/promises';
import { join } from 'path';
import { Project } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects.query.dto';
import { encryptSecret } from '../common/utils/crypto.util';

export interface PublicProject {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  targetUsername: string;
  description?: string | null;
  status: Project['status'];
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedProjects {
  items: PublicProject[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto): Promise<PublicProject> {
    const targetPasswordEncrypted = encryptSecret(dto.targetPassword);
    const entity = this.projects.create({
      ownerId,
      name: dto.name,
      url: dto.url,
      targetUsername: dto.targetUsername,
      targetPasswordEncrypted,
      description: dto.description ?? null,
      status: 'created',
    });
    const saved = await this.projects.save(entity);
    return this.toPublic(saved);
  }

  async list(
    ownerId: string,
    q: ListProjectsQueryDto,
  ): Promise<PaginatedProjects> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.projects
      .createQueryBuilder('p')
      .where('p.ownerId = :ownerId', { ownerId });
    if (q.search && q.search.trim().length > 0) {
      qb.andWhere('p.name ILIKE :s', { s: `%${q.search.trim()}%` });
    }
    qb.orderBy('p.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.toPublic(r)),
      total,
      page,
      limit,
    };
  }

  async findOneOwned(id: string, ownerId: string): Promise<PublicProject> {
    const project = await this.findEntityOwnedOrThrow(id, ownerId);
    return this.toPublic(project);
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateProjectDto,
  ): Promise<PublicProject> {
    const project = await this.findEntityOwnedOrThrow(id, ownerId);
    if (dto.name !== undefined) project.name = dto.name;
    if (dto.url !== undefined) project.url = dto.url;
    if (dto.targetUsername !== undefined)
      project.targetUsername = dto.targetUsername;
    if (dto.description !== undefined)
      project.description = dto.description ?? null;
    if (dto.targetPassword !== undefined && dto.targetPassword.length > 0) {
      project.targetPasswordEncrypted = encryptSecret(dto.targetPassword);
    }
    const saved = await this.projects.save(project);
    return this.toPublic(saved);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findEntityOwnedOrThrow(id, ownerId);
    await this.projects.remove(project);

    // Remove storage folder created by crawler runs (screenshots, scripts, raw data, logs).
    const projectStorageDir = join(process.cwd(), 'storage', 'projects', id);
    try {
      await rm(projectStorageDir, { recursive: true, force: true });
      this.logger.log(`Deleted storage for project ${id}`);
    } catch (err) {
      // Non-fatal: log the error but don't fail the HTTP response.
      this.logger.warn(`Could not delete storage for project ${id}: ${(err as Error).message}`);
    }
  }

  async findEntityOwnedOrThrow(id: string, ownerId: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id, ownerId } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  toPublic(p: Project): PublicProject {
    return {
      id: p.id,
      ownerId: p.ownerId,
      name: p.name,
      url: p.url,
      targetUsername: p.targetUsername,
      description: p.description ?? null,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
