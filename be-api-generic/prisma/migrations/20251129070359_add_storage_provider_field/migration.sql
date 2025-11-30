-- AlterTable
ALTER TABLE "files" ADD COLUMN     "storageProvider" TEXT;

-- CreateIndex
CREATE INDEX "files_storageProvider_idx" ON "files"("storageProvider");
