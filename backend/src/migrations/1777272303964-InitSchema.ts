import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1777272303964 implements MigrationInterface {
    name = 'InitSchema1777272303964'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "displayName" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('created', 'crawling', 'crawled', 'failed')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "name" character varying(80) NOT NULL, "url" character varying NOT NULL, "targetUsername" character varying NOT NULL, "targetPasswordEncrypted" text NOT NULL, "description" character varying(500), "status" "public"."projects_status_enum" NOT NULL DEFAULT 'created', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c65601b27c667a35be76ba3691" ON "projects" ("ownerId", "updatedAt") `);
        await queryRunner.query(`CREATE TYPE "public"."crawl_runs_status_enum" AS ENUM('queued', 'running', 'success', 'failed')`);
        await queryRunner.query(`CREATE TABLE "crawl_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "status" "public"."crawl_runs_status_enum" NOT NULL DEFAULT 'queued', "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "finishedAt" TIMESTAMP WITH TIME ZONE, "errorMessage" text, "scriptPath" character varying NOT NULL, "rawDataPath" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cd392888d25b4db48af96de4402" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_13d15c8e3cef65ff1fde555397" ON "crawl_runs" ("projectId", "startedAt") `);
        await queryRunner.query(`CREATE TABLE "ui_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "crawlRunId" uuid NOT NULL, "url" character varying NOT NULL, "title" character varying, "parentNodeId" uuid, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ui_nodes_crawlRun_url" UNIQUE ("crawlRunId", "url"), CONSTRAINT "PK_07942b45594a2ced00c43d08a5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9b4ade086e675085cb5e7ebb46" ON "ui_nodes" ("crawlRunId") `);
        await queryRunner.query(`CREATE TABLE "ui_edges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "crawlRunId" uuid NOT NULL, "fromNodeId" uuid NOT NULL, "toNodeId" uuid NOT NULL, "triggerLabel" character varying NOT NULL, "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9dfd38e72dc3bdcb9f5cb0b9354" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ee34171531e47ffb46d6973aca" ON "ui_edges" ("crawlRunId") `);
        await queryRunner.query(`CREATE TABLE "generated_test_case_prompts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "promptText" text NOT NULL, "generatedResult" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3b76388f2d8ae4aab4a6cd34475" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_56c4655acb1b5ddbe7589f200a" ON "generated_test_case_prompts" ("projectId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_a8e7e6c3f9d9528ed35fe5bae33" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "crawl_runs" ADD CONSTRAINT "FK_ca568bcdd5152f6e8d021857f5c" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ui_nodes" ADD CONSTRAINT "FK_617dd744793af8e1354e66b8365" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ui_nodes" ADD CONSTRAINT "FK_9b4ade086e675085cb5e7ebb468" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ui_edges" ADD CONSTRAINT "FK_ee34171531e47ffb46d6973acae" FOREIGN KEY ("crawlRunId") REFERENCES "crawl_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ui_edges" ADD CONSTRAINT "FK_cfd5aafa37bf79a49e789629281" FOREIGN KEY ("fromNodeId") REFERENCES "ui_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ui_edges" ADD CONSTRAINT "FK_54bf6e44c7028a93332cde060e4" FOREIGN KEY ("toNodeId") REFERENCES "ui_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "generated_test_case_prompts" ADD CONSTRAINT "FK_4de7d93acbf964a917427d78fd6" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "generated_test_case_prompts" DROP CONSTRAINT "FK_4de7d93acbf964a917427d78fd6"`);
        await queryRunner.query(`ALTER TABLE "ui_edges" DROP CONSTRAINT "FK_54bf6e44c7028a93332cde060e4"`);
        await queryRunner.query(`ALTER TABLE "ui_edges" DROP CONSTRAINT "FK_cfd5aafa37bf79a49e789629281"`);
        await queryRunner.query(`ALTER TABLE "ui_edges" DROP CONSTRAINT "FK_ee34171531e47ffb46d6973acae"`);
        await queryRunner.query(`ALTER TABLE "ui_nodes" DROP CONSTRAINT "FK_9b4ade086e675085cb5e7ebb468"`);
        await queryRunner.query(`ALTER TABLE "ui_nodes" DROP CONSTRAINT "FK_617dd744793af8e1354e66b8365"`);
        await queryRunner.query(`ALTER TABLE "crawl_runs" DROP CONSTRAINT "FK_ca568bcdd5152f6e8d021857f5c"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_a8e7e6c3f9d9528ed35fe5bae33"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_56c4655acb1b5ddbe7589f200a"`);
        await queryRunner.query(`DROP TABLE "generated_test_case_prompts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee34171531e47ffb46d6973aca"`);
        await queryRunner.query(`DROP TABLE "ui_edges"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b4ade086e675085cb5e7ebb46"`);
        await queryRunner.query(`DROP TABLE "ui_nodes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_13d15c8e3cef65ff1fde555397"`);
        await queryRunner.query(`DROP TABLE "crawl_runs"`);
        await queryRunner.query(`DROP TYPE "public"."crawl_runs_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c65601b27c667a35be76ba3691"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
