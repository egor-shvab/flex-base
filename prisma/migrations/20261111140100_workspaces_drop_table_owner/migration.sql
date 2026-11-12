-- Workspaces, part B: a table now belongs to a workspace, and the workspace numbers its tables.
-- Both columns are derivable from part A's data, not user data.

-- DropForeignKey
ALTER TABLE "Table" DROP CONSTRAINT "Table_userId_fkey";

-- DropIndex
DROP INDEX "Table_userId_name_key";

-- DropIndex
DROP INDEX "Table_userId_number_key";

-- AlterTable
ALTER TABLE "Table" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "tableCounter";

