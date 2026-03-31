-- CreateEnum
CREATE TYPE "status_anexo" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "anexos_ocr_resultados" (
    "id"                    UUID NOT NULL DEFAULT gen_random_uuid(),
    "anexo_id"              UUID NOT NULL,
    "status"                "status_anexo" NOT NULL DEFAULT 'UPLOADED',
    "extracted_amount"      DECIMAL(10,2),
    "extracted_date"        DATE,
    "extracted_description" VARCHAR(500),
    "extracted_type"        VARCHAR(50),
    "confidence_score"      DECIMAL(5,4),
    "raw_text"              TEXT,
    "error_message"         VARCHAR(500),
    "processed_at"          TIMESTAMPTZ(6),
    "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "anexos_ocr_resultados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anexos_ocr_resultados_anexo_id_key" ON "anexos_ocr_resultados"("anexo_id");

-- AddForeignKey
ALTER TABLE "anexos_ocr_resultados" ADD CONSTRAINT "fk_ocr_resultado_anexo"
    FOREIGN KEY ("anexo_id") REFERENCES "anexos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
