-- A display name for every user. Written by hand rather than generated: the column is required
-- and the table already holds rows, so it is added nullable, backfilled, then made NOT NULL.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- The email's local part is the only name an existing account has; registration validates the
-- email, so the part before the `@` is never empty, and at most 64 characters fits the 80 cap.
UPDATE "User" SET "name" = split_part("email", '@', 1);

-- Plain SET NOT NULL: one row per account, nothing that grows with user data.
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
