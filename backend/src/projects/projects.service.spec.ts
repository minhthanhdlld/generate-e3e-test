import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ProjectsService } from './projects.service';
import { Project } from './entities/project.entity';

// Fake repo backed by a Map so we can exercise owner scoping without Postgres.
function makeFakeRepo() {
  const store = new Map<string, Project>();
  return {
    create: (data: Partial<Project>) => ({ ...data } as Project),
    save: jest.fn(async (p: Project) => {
      const id = p.id ?? `id-${store.size + 1}`;
      const now = new Date();
      const row = {
        ...p,
        id,
        createdAt: p.createdAt ?? now,
        updatedAt: now,
      } as Project;
      store.set(id, row);
      return row;
    }),
    findOne: jest.fn(async ({ where }: { where: Partial<Project> }) => {
      for (const r of store.values()) {
        const matches = Object.entries(where).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        );
        if (matches) return r;
      }
      return null;
    }),
    remove: jest.fn(async (p: Project) => {
      store.delete(p.id);
      return p;
    }),
    createQueryBuilder: jest.fn(),
  };
}

describe('ProjectsService — owner scoping', () => {
  let svc: ProjectsService;
  let repo: ReturnType<typeof makeFakeRepo>;

  beforeAll(() => {
    process.env.PROJECT_SECRET_KEY = randomBytes(32).toString('base64');
  });

  beforeEach(async () => {
    repo = makeFakeRepo();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: repo },
      ],
    }).compile();
    svc = moduleRef.get(ProjectsService);
  });

  it('user A cannot read user B project', async () => {
    const a = await svc.create('user-A', {
      name: 'Owned by A',
      url: 'https://a.test',
      targetUsername: 'u',
      targetPassword: 'p',
    });
    await expect(svc.findOneOwned(a.id, 'user-B')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const owner = await svc.findOneOwned(a.id, 'user-A');
    expect(owner.id).toBe(a.id);
  });

  it('encrypts targetPassword at rest', async () => {
    const created = await svc.create('user-A', {
      name: 'Crypto check',
      url: 'https://a.test',
      targetUsername: 'u',
      targetPassword: 'plaintext-secret',
    });
    // Returned PublicProject does not expose targetPasswordEncrypted, but we
    // can pull the persisted entity via the fake repo's Map.
    const persisted = (
      repo.save as unknown as { mock: { calls: Array<[Project]> } }
    ).mock.calls[0][0];
    expect(persisted.targetPasswordEncrypted).toBeDefined();
    expect(persisted.targetPasswordEncrypted).not.toContain('plaintext-secret');
    expect((created as unknown as Record<string, unknown>).targetPasswordEncrypted).toBeUndefined();
  });
});
