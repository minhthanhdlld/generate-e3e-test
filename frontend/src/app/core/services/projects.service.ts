import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { CreateProjectInput, Project } from '../models/project.model';

export interface PaginatedProjects {
  items: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateProjectInput {
  name?: string;
  url?: string;
  targetUsername?: string;
  targetPassword?: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(ApiService);

  list(query: {
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Observable<PaginatedProjects> {
    return this.api.get<PaginatedProjects>('/projects', {
      ...(query.search ? { search: query.search } : {}),
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  create(input: CreateProjectInput): Observable<Project> {
    return this.api.post<Project>('/projects', input);
  }

  findOne(id: string): Observable<Project> {
    return this.api.get<Project>(`/projects/${id}`);
  }

  update(id: string, input: UpdateProjectInput): Observable<Project> {
    return this.api.patch<Project>(`/projects/${id}`, input);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/projects/${id}`);
  }
}
