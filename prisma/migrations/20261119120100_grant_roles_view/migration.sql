-- Every member saw every role until now: each existing role keeps that, and an owner narrows it
-- role by role. One pass over the roles, which are capped per workspace.
UPDATE "WorkspaceRole"
SET "permissions" = array_append("permissions", 'ROLES_VIEW'::"WorkspacePermission")
WHERE NOT ('ROLES_VIEW' = ANY("permissions"));
