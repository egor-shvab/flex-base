-- A role's defaults leave: every table it reaches gets a row of its own, so nothing anyone may do
-- today changes, and a table created later has no row and stays closed to the role. One
-- transaction: the columns go only once every row is written. Rows number roles × tables, and
-- roles are capped per workspace.
BEGIN;

INSERT INTO "RoleTableAccess" ("workspaceId", "roleId", "tableId", "readScope", "canCreate", "updateScope", "deleteScope")
SELECT r."workspaceId", r."id", t."id", r."readScope", r."canCreate", r."updateScope", r."deleteScope"
FROM "WorkspaceRole" r
JOIN "Table" t ON t."workspaceId" = r."workspaceId"
WHERE (r."readScope" <> 'NONE' OR r."canCreate" OR r."updateScope" <> 'NONE' OR r."deleteScope" <> 'NONE')
  AND NOT EXISTS (
    SELECT 1 FROM "RoleTableAccess" a WHERE a."roleId" = r."id" AND a."tableId" = t."id"
  );

-- AlterTable
ALTER TABLE "WorkspaceRole" DROP COLUMN "canCreate",
DROP COLUMN "deleteScope",
DROP COLUMN "readScope",
DROP COLUMN "updateScope";

COMMIT;
