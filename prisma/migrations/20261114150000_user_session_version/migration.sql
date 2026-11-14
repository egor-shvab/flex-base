-- The version every auth token carries; logging out raises it, so tokens already issued stop
-- passing. A constant default makes this a catalogue change, not a rewrite of "User".

-- AlterTable
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
