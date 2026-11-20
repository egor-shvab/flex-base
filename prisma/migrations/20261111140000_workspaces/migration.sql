-- Workspaces, part A: additive. Every existing user gets a personal workspace holding their tables,
-- the three default roles and an owner membership. Part B drops what this makes redundant.
-- Hand-written ids are not cuids; nothing reads an id's format.

-- CreateEnum
CREATE TYPE "WorkspacePermission" AS ENUM ('WORKSPACE_UPDATE', 'MEMBERS_INVITE', 'MEMBERS_MANAGE', 'ROLES_MANAGE', 'TABLES_MANAGE', 'RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE');

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "workspaceId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tableCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceRole" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" "WorkspacePermission"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- Backfill. The role literals repeat `DEFAULT_WORKSPACE_ROLES`; a migration is frozen, so they may.
-- The public id is 10 hex characters, a subset of the address alphabet.
INSERT INTO "Workspace" ("id", "publicId", "name", "ownerId", "tableCounter", "updatedAt")
SELECT 'w' || substr(md5(u."id" || ':workspace'), 1, 24),
       substr(md5(random()::text || u."id"), 1, 10),
       'Personal workspace',
       u."id",
       u."tableCounter",
       CURRENT_TIMESTAMP
FROM "User" AS u;

INSERT INTO "WorkspaceRole" ("id", "workspaceId", "name", "permissions")
SELECT 'r' || substr(md5(w."id" || ':' || role."name"), 1, 24), w."id", role."name", role."permissions"
FROM "Workspace" AS w
CROSS JOIN (
  VALUES
    ('Admin', ARRAY['WORKSPACE_UPDATE', 'MEMBERS_INVITE', 'MEMBERS_MANAGE', 'ROLES_MANAGE', 'TABLES_MANAGE', 'RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE']::"WorkspacePermission"[]),
    ('Editor', ARRAY['RECORDS_CREATE', 'RECORDS_UPDATE', 'RECORDS_DELETE']::"WorkspacePermission"[]),
    ('Viewer', ARRAY[]::"WorkspacePermission"[])
) AS role ("name", "permissions");

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "roleId")
SELECT 'm' || substr(md5(w."id" || ':' || w."ownerId"), 1, 24), w."id", w."ownerId", r."id"
FROM "Workspace" AS w
JOIN "WorkspaceRole" AS r ON r."workspaceId" = w."id" AND r."name" = 'Admin';

UPDATE "Table" AS t
SET "workspaceId" = w."id"
FROM "Workspace" AS w
WHERE w."ownerId" = t."userId";

UPDATE "User" AS u
SET "lastWorkspaceId" = w."id"
FROM "Workspace" AS w
WHERE w."ownerId" = u."id";

-- Plain SET NOT NULL: one row per table, nothing that grows with user data.
ALTER TABLE "Table" ALTER COLUMN "workspaceId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_publicId_key" ON "Workspace"("publicId");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRole_workspaceId_name_key" ON "WorkspaceRole"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_roleId_idx" ON "WorkspaceMember"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Table_workspaceId_name_key" ON "Table"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Table_workspaceId_number_key" ON "Table"("workspaceId", "number");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_lastWorkspaceId_fkey" FOREIGN KEY ("lastWorkspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceRole" ADD CONSTRAINT "WorkspaceRole_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "WorkspaceRole"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
