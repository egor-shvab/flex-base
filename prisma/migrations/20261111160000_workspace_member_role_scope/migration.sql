-- A member's role key carries the workspace, so a role of another workspace cannot be assigned.
-- Validates every member row while it holds the lock: small, as roles and members are few per
-- workspace.

-- DropForeignKey
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_roleId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceRole_workspaceId_id_key" ON "WorkspaceRole"("workspaceId", "id");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_roleId_fkey" FOREIGN KEY ("workspaceId", "roleId") REFERENCES "WorkspaceRole"("workspaceId", "id") ON DELETE NO ACTION ON UPDATE CASCADE;
