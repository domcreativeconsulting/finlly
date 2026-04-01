-- Migration: add extracted_json to anexos_ocr_resultados
ALTER TABLE "anexos_ocr_resultados" ADD COLUMN "extracted_json" JSONB;
