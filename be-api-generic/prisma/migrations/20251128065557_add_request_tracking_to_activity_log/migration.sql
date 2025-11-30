-- AlterTable
ALTER TABLE "activity_logs" ADD COLUMN     "processingTime" INTEGER,
ADD COLUMN     "requestId" TEXT;

-- CreateIndex
CREATE INDEX "activity_logs_requestId_idx" ON "activity_logs"("requestId");
