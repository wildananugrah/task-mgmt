-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_fileId_fkey";

-- AlterTable
ALTER TABLE "articles" ALTER COLUMN "fileId" DROP NOT NULL,
ALTER COLUMN "fileId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "articles_fileId_idx" ON "articles"("fileId");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
