-- AddRetryFieldsToAnexoOcrResultado
ALTER TABLE "anexos_ocr_resultados" ADD COLUMN "processing_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "anexos_ocr_resultados" ADD COLUMN "processing_started_at" TIMESTAMPTZ(6);
ALTER TABLE "anexos_ocr_resultados" ADD COLUMN "failed_at" TIMESTAMPTZ(6);
ALTER TABLE "anexos_ocr_resultados" ADD COLUMN "bullmq_job_id" VARCHAR(100);
