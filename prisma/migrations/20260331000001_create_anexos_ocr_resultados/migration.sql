CREATE TYPE "StatusAnexo" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED');

CREATE TABLE "anexos_ocr_resultados" (
  "id"                    UUID          NOT NULL DEFAULT gen_random_uuid(),
  "anexo_id"              UUID          NOT NULL,
  "status"                "StatusAnexo" NOT NULL DEFAULT 'UPLOADED',
  "extracted_amount"      DECIMAL(10,2),
  "extracted_date"        DATE,
  "extracted_description" VARCHAR(500),
  "extracted_type"        VARCHAR(50),
  "confidence_score"      DECIMAL(5,4),
  "raw_text"              TEXT,
  "error_message"         VARCHAR(500),
  "processed_at"          TIMESTAMPTZ(6),
  "created_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "anexos_ocr_resultados_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "anexos_ocr_resultados_anexo_id_key" UNIQUE ("anexo_id"),
  CONSTRAINT "fk_ocr_resultado_anexo" FOREIGN KEY ("anexo_id")
    REFERENCES "anexos"("id") ON DELETE CASCADE
);