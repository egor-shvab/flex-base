-- The three record permissions become the role's record defaults, which can also say "only their
-- own records". One transaction: the values leave the enum only after they are copied out of every
-- role and removed from its array, or the type swap would fail on them. "WorkspaceRole" is capped
-- per workspace, so rewriting its column is cheap.
BEGIN;

-- CreateEnum
CREATE TYPE "RecordScope" AS ENUM ('NONE', 'OWN', 'ALL');

-- CreateEnum
CREATE TYPE "FieldAccess" AS ENUM ('HIDDEN', 'READ');

-- AlterTable
ALTER TABLE "WorkspaceRole" ADD COLUMN     "canCreate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleteScope" "RecordScope" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "readScope" "RecordScope" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "updateScope" "RecordScope" NOT NULL DEFAULT 'NONE';

-- Backfill
UPDATE "WorkspaceRole" SET
  "canCreate" = 'RECORDS_CREATE' = ANY("permissions"),
  "updateScope" = CASE WHEN 'RECORDS_UPDATE' = ANY("permissions") THEN 'ALL' ELSE 'NONE' END::"RecordScope",
  "deleteScope" = CASE WHEN 'RECORDS_DELETE' = ANY("permissions") THEN 'ALL' ELSE 'NONE' END::"RecordScope",
  "permissions" = array_remove(array_remove(array_remove("permissions",
    'RECORDS_CREATE'), 'RECORDS_UPDATE'), 'RECORDS_DELETE');

-- AlterEnum
CREATE TYPE "WorkspacePermission_new" AS ENUM ('WORKSPACE_UPDATE', 'MEMBERS_INVITE', 'MEMBERS_MANAGE', 'ROLES_MANAGE', 'TABLES_MANAGE');
ALTER TABLE "WorkspaceRole" ALTER COLUMN "permissions" TYPE "WorkspacePermission_new"[] USING ("permissions"::text::"WorkspacePermission_new"[]);
ALTER TYPE "WorkspacePermission" RENAME TO "WorkspacePermission_old";
ALTER TYPE "WorkspacePermission_new" RENAME TO "WorkspacePermission";
DROP TYPE "public"."WorkspacePermission_old";

-- CreateIndex
CREATE UNIQUE INDEX "Table_workspaceId_id_key" ON "Table"("workspaceId", "id");

-- CreateTable
CREATE TABLE "RoleTableAccess" (
    "workspaceId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "readScope" "RecordScope" NOT NULL,
    "canCreate" BOOLEAN NOT NULL,
    "updateScope" "RecordScope" NOT NULL,
    "deleteScope" "RecordScope" NOT NULL,

    CONSTRAINT "RoleTableAccess_pkey" PRIMARY KEY ("roleId","tableId")
);

-- CreateTable
CREATE TABLE "RoleFieldAccess" (
    "workspaceId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "access" "FieldAccess" NOT NULL,

    CONSTRAINT "RoleFieldAccess_pkey" PRIMARY KEY ("roleId","fieldId")
);

-- CreateIndex
CREATE INDEX "RoleTableAccess_tableId_idx" ON "RoleTableAccess"("tableId");

-- CreateIndex
CREATE INDEX "RoleFieldAccess_fieldId_idx" ON "RoleFieldAccess"("fieldId");

-- AddForeignKey
ALTER TABLE "RoleTableAccess" ADD CONSTRAINT "RoleTableAccess_workspaceId_roleId_fkey" FOREIGN KEY ("workspaceId", "roleId") REFERENCES "WorkspaceRole"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleTableAccess" ADD CONSTRAINT "RoleTableAccess_workspaceId_tableId_fkey" FOREIGN KEY ("workspaceId", "tableId") REFERENCES "Table"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleFieldAccess" ADD CONSTRAINT "RoleFieldAccess_workspaceId_roleId_fkey" FOREIGN KEY ("workspaceId", "roleId") REFERENCES "WorkspaceRole"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleFieldAccess" ADD CONSTRAINT "RoleFieldAccess_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
