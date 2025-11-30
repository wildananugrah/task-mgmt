-- AlterTable
ALTER TABLE "articles" ADD COLUMN     "fileId" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
