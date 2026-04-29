import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { CrawlerModule } from './crawler/crawler.module';
import { UiGraphModule } from './ui-graph/ui-graph.module';
import { TestCasesModule } from './test-cases/test-cases.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USER ?? 'verifai_app',
        password: process.env.DB_PASSWORD ?? 'verifai_app_local',
        database: process.env.DB_NAME ?? 'verifai',
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    CommonModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    CrawlerModule,
    UiGraphModule,
    TestCasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
