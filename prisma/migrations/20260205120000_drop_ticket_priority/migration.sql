-- Drop ticket priority column and enum.
ALTER TABLE "tickets" DROP COLUMN "priority";
DROP TYPE "TicketPriority";
