/*
  Warnings:

  - A unique constraint covering the columns `[discordGuildId,discordEventId]` on the table `event_dedups` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "MessageSource" ADD VALUE 'discord';

-- AlterTable
ALTER TABLE "event_dedups" ADD COLUMN     "discordEventId" TEXT,
ADD COLUMN     "discordGuildId" TEXT,
ALTER COLUMN "slackEventId" DROP NOT NULL,
ALTER COLUMN "slackTeamId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "discordUserId" TEXT,
ADD COLUMN     "discordUserName" TEXT,
ADD COLUMN     "rawDiscordEvent" JSONB;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "discordChannelId" TEXT,
ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "discordPermalink" TEXT,
ADD COLUMN     "discordThreadId" TEXT;

-- CreateTable
CREATE TABLE "discord_installations" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "discordGuildId" TEXT NOT NULL,
    "discordGuildName" TEXT NOT NULL,
    "botAccessToken" TEXT NOT NULL,
    "botUserId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discord_channel_configs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "discordChannelId" TEXT NOT NULL,
    "discordChannelName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discord_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "discord_installations_accountId_key" ON "discord_installations"("accountId");

-- CreateIndex
CREATE INDEX "discord_installations_discordGuildId_idx" ON "discord_installations"("discordGuildId");

-- CreateIndex
CREATE INDEX "discord_channel_configs_accountId_idx" ON "discord_channel_configs"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "discord_channel_configs_accountId_discordChannelId_key" ON "discord_channel_configs"("accountId", "discordChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "event_dedups_discordGuildId_discordEventId_key" ON "event_dedups"("discordGuildId", "discordEventId");

-- CreateIndex
CREATE INDEX "messages_discordMessageId_idx" ON "messages"("discordMessageId");

-- CreateIndex
CREATE INDEX "tickets_accountId_discordThreadId_idx" ON "tickets"("accountId", "discordThreadId");

-- CreateIndex
CREATE INDEX "tickets_discordChannelId_discordThreadId_idx" ON "tickets"("discordChannelId", "discordThreadId");

-- AddForeignKey
ALTER TABLE "discord_installations" ADD CONSTRAINT "discord_installations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discord_channel_configs" ADD CONSTRAINT "discord_channel_configs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
