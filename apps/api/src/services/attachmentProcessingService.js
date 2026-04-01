import prisma from '../utils/database.js';
import { PermanentError } from '../errors/PermanentError.js';
import { processarDocumento } from './ocrService.js';
import logger from '../logger.js';

/**
 * Processa um anexo: valida, atualiza status e executa OCR.
 *
 * @param {{ attachmentId: string, storagePath?: string, mimeType?: string, jobId?: string, requestId?: string }} params
 * @returns {Promise<object>} Resultado do processamento OCR
 */
export async function processAttachment({ attachmentId, storagePath, mimeType, jobId, requestId }) {
  const logCtx = { attachmentId, jobId, requestId };

  const anexo = await prisma.anexo.findFirst({
    where: { id: attachmentId, deleted_at: null },
    include: { ocr_resultado: true },
  });

  if (!anexo) {
    throw new PermanentError(`Anexo não encontrado ou removido: ${attachmentId}`);
  }

  const ocrResultado = anexo.ocr_resultado;
  const statusAtual = ocrResultado?.status ?? null;

  if (statusAtual === 'PROCESSED') {
    logger.warn({ ...logCtx, statusAtual }, 'Anexo já processado — reprocessamento ignorado.');
    return null;
  }

  await prisma.anexoOcrResultado.update({
    where: { anexo_id: attachmentId },
    data: {
      status: 'PROCESSING',
      processing_attempts: { increment: 1 },
      processing_started_at: new Date(),
      bullmq_job_id: jobId ?? null,
      updated_at: new Date(),
    },
  });

  logger.info({ ...logCtx, statusAnterior: statusAtual }, 'Iniciando processamento do anexo.');

  const filePath = storagePath ?? anexo.storage_path;
  const mime = mimeType ?? anexo.mime_type;

  let resultado;
  try {
    resultado = await processarDocumento({
      anexoId: attachmentId,
      filePath,
      mimeType: mime,
    });
  } catch (ocrErr) {
    logger.error({ ...logCtx, err: ocrErr }, 'Falha no processamento OCR do anexo.');
    await prisma.anexoOcrResultado.update({
      where: { anexo_id: attachmentId },
      data: {
        status: 'FAILED',
        error_message: ocrErr.message?.slice(0, 500) ?? 'Erro desconhecido no OCR',
        failed_at: new Date(),
        updated_at: new Date(),
      },
    });
    throw ocrErr;
  }

  try {
    await prisma.anexoOcrResultado.update({
      where: { anexo_id: attachmentId },
      data: {
        status: 'PROCESSED',
        processed_at: new Date(),
        extracted_amount: resultado.extractedAmount ?? null,
        extracted_date: resultado.extractedDate ?? null,
        extracted_description: resultado.extractedDescription ?? null,
        extracted_type: resultado.extractedType ?? null,
        confidence_score: resultado.confidenceScore ?? null,
        raw_text: resultado.rawText ?? null,
        extracted_json: resultado.structuredJson ?? null,
        error_message: null,
        updated_at: new Date(),
      },
    });
  } catch (persistErr) {
    logger.error({ ...logCtx, err: persistErr }, 'Falha ao persistir resultado do OCR no banco.');
    await prisma.anexoOcrResultado.update({
      where: { anexo_id: attachmentId },
      data: {
        status: 'FAILED',
        error_message: persistErr.message?.slice(0, 500) ?? 'Erro ao persistir resultado OCR',
        failed_at: new Date(),
        updated_at: new Date(),
      },
    });
    throw persistErr;
  }

  logger.info({ ...logCtx }, 'Anexo processado com sucesso.');

  return resultado;
}
