/*
  Warnings:

  - The MessageSource enum will be recreated to remove unused values.

*/
-- Normalize deprecated sources before tightening enum values.
UPDATE "messages"
SET "source" = 'visitor'
WHERE "source" = 'agent_dashboard'
  AND "slackTs" IS NULL
  AND "discordMessageId" IS NULL;

UPDATE "messages"
SET "source" = 'slack'
WHERE "source" = 'agent_dashboard'
  AND "slackTs" IS NOT NULL;

UPDATE "messages"
SET "source" = 'discord'
WHERE "source" = 'agent_dashboard'
  AND "discordMessageId" IS NOT NULL;

UPDATE "messages"
SET "source" = 'slack'
WHERE "source" = 'agent_dashboard';

UPDATE "messages"
SET "source" = 'slack'
WHERE "source" = 'system';

-- Recreate enum without deprecated values.
ALTER TYPE "MessageSource" RENAME TO "MessageSource_old";
CREATE TYPE "MessageSource" AS ENUM ('visitor', 'slack', 'discord');

ALTER TABLE "messages"
ALTER COLUMN "source" TYPE "MessageSource"
USING ("source"::text::"MessageSource");

DROP TYPE "MessageSource_old";
