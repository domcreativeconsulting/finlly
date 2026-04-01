/*
  Warnings:

  - The `status` column on the `anexos_ocr_resultados` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "status_anexo" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- DropForeignKey
ALTER TABLE "anexos_ocr_resultados" DROP CONSTRAINT "fk_ocr_resultado_anexo";

-- AlterTable
ALTER TABLE "anexos" ALTER COLUMN "storage_path" DROP DEFAULT;

-- AlterTable
ALTER TABLE "anexos_ocr_resultados" DROP COLUMN "status",
ADD COLUMN     "status" "status_anexo" NOT NULL DEFAULT 'UPLOADED';

-- DropEnum
DROP TYPE "StatusAnexo";

-- AddForeignKey
ALTER TABLE "anexos_ocr_resultados" ADD CONSTRAINT "fk_ocr_resultado_anexo" FOREIGN KEY ("anexo_id") REFERENCES "anexos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
