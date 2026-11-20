-- Its own migration: PostgreSQL refuses a new enum value's use in the transaction that adds it.
ALTER TYPE "WorkspacePermission" ADD VALUE 'ROLES_VIEW' BEFORE 'ROLES_MANAGE';
