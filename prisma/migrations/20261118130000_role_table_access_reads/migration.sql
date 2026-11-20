-- A role closed to a table has no row there, so a row always lets its role read. A row reading
-- nothing grants nothing — no action passes the read — so deleting one changes no one's access, and
-- the check keeps a write from bringing it back. The check scans the table once under its lock:
-- rows number roles × tables, and roles are capped per workspace.
DELETE FROM "RoleTableAccess" WHERE "readScope" = 'NONE';

ALTER TABLE "RoleTableAccess" ADD CONSTRAINT "RoleTableAccess_readScope_check" CHECK ("readScope" <> 'NONE');
