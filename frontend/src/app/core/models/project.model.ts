export type ProjectStatus = 'created' | 'crawling' | 'crawled' | 'failed';

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  targetUsername: string;
  description?: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  url: string;
  targetUsername: string;
  targetPassword: string;
  description?: string;
}
