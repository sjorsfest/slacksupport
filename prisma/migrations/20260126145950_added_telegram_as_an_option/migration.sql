/*
  Warnings:

  - A unique constraint covering the columns `[telegramChatId,telegramUpdateId]` on the table `event_dedups` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "MessageSource" ADD VALUE 'telegram';

-- AlterTable
ALTER TABLE "event_dedups" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramUpdateId" INTEGER;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "rawTelegramEvent" JSONB,
ADD COLUMN     "telegramMessageId" INTEGER,
ADD COLUMN     "telegramUserId" TEXT,
ADD COLUMN     "telegramUserName" TEXT;

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramPermalink" TEXT,
ADD COLUMN     "telegramRootMessageId" INTEGER,
ADD COLUMN     "telegramTopicId" INTEGER;

-- CreateTable
CREATE TABLE "telegram_group_configs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "telegramChatId" TEXT NOT NULL,
    "telegramChatTitle" TEXT NOT NULL,
    "isForumEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telegram_group_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telegram_group_configs_accountId_idx" ON "telegram_group_configs"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_group_configs_accountId_telegramChatId_key" ON "telegram_group_configs"("accountId", "telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_group_configs_telegramChatId_key" ON "telegram_group_configs"("telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX "event_dedups_telegramChatId_telegramUpdateId_key" ON "event_dedups"("telegramChatId", "telegramUpdateId");

-- CreateIndex
CREATE INDEX "messages_telegramMessageId_idx" ON "messages"("telegramMessageId");

-- CreateIndex
CREATE INDEX "tickets_accountId_telegramTopicId_idx" ON "tickets"("accountId", "telegramTopicId");

-- CreateIndex
CREATE INDEX "tickets_telegramChatId_telegramTopicId_idx" ON "tickets"("telegramChatId", "telegramTopicId");

-- AddForeignKey
ALTER TABLE "telegram_group_configs" ADD CONSTRAINT "telegram_group_configs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
