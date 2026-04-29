import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../users/entities/user.entity';

const ADMIN_EMAIL = 'qa@local.test';
const ADMIN_PASSWORD = 'Passw0rd!';
const ADMIN_DISPLAY_NAME = 'QA';
const BCRYPT_ROUNDS = 12;

async function run(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email: ADMIN_EMAIL } });
    if (existing) {
      console.log('[seed] admin already exists');
      return;
    }
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    const user = repo.create({
      email: ADMIN_EMAIL,
      passwordHash,
      displayName: ADMIN_DISPLAY_NAME,
    });
    await repo.save(user);
    console.log('[seed] admin created');
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
