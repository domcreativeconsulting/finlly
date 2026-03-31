import prisma from '../utils/database.js';
import { processarDocumento } from '../services/ocrService.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

let timeoutHandle = null;

/**
 * Processa um job OCR pendente.
 * @param {object} job
 */
async function processarJob(job) {
  const { id, payload } = job;
  const { anexo_id, file_path, mime_type } = payload;

  await prisma.job.update({
    where: { id },
    data: { status: 'processando', iniciado_em: new Date() },
  });

  try {
    const resultado = await processarDocumento({
      anexoId: anexo_id,
      filePath: file_path,
      mimeType: mime_type,
    });

    await prisma.anexoOcrResultado.update({
      where: { anexo_id },
      data: {
        status: 'PROCESSED',
        extracted_amount: resultado.extractedAmount ?? null,
        extracted_date: resultado.extractedDate ?? null,
        extracted_description: resultado.extractedDescription ?? null,
        extracted_type: resultado.extractedType ?? null,
        confidence_score: resultado.confidenceScore ?? null,
        raw_text: resultado.rawText ?? null,
        processed_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.job.update({
      where: { id },
      data: { status: 'concluido', concluido_em: new Date(), updated_at: new Date() },
    });

    logger.info({ jobId: String(id), anexoId: anexo_id }, 'Job OCR concluído com sucesso.');
  } catch (err) {
    const novasTentativas = job.tentativas + 1;
    const falhou = novasTentativas >= job.max_tentativas;

    await prisma.job.update({
      where: { id },
      data: {
        status: falhou ? 'falhou' : 'pendente',
        tentativas: novasTentativas,
        erro: err.message,
        updated_at: new Date(),
      },
    });

    if (falhou) {
      await prisma.anexoOcrResultado.update({
        where: { anexo_id },
        data: {
          status: 'FAILED',
          error_message: err.message.slice(0, 500),
          updated_at: new Date(),
        },
      });
      logger.error({ jobId: String(id), anexoId: anexo_id, err }, 'Job OCR falhou definitivamente.');
    } else {
      logger.warn({ jobId: String(id), tentativas: novasTentativas }, 'Job OCR com erro, será reprocessado.');
    }
  }
}

/**
 * Executa o ciclo de processamento OCR: busca um job pendente e processa.
 */
async function run() {
  try {
    const job = await prisma.job.findFirst({
      where: {
        tipo: 'ocr_processar',
        status: 'pendente',
        OR: [{ agendado_para: null }, { agendado_para: { lte: new Date() } }],
      },
      orderBy: { agendado_para: 'asc' },
    });

    if (job && job.tentativas < job.max_tentativas) {
      await processarJob(job);
    }
  } catch (err) {
    logger.error({ err }, 'Erro no ciclo do job OCR.');
  } finally {
    scheduleNext();
  }
}

/**
 * Agenda o próximo ciclo de processamento.
 */
function scheduleNext() {
  const intervalMs = config.OCR_JOB_INTERVAL_MS;
  timeoutHandle = setTimeout(run, intervalMs);
}

/**
 * Inicia o job OCR.
 */
export function startOcrJob() {
  logger.info({ intervalMs: config.OCR_JOB_INTERVAL_MS }, 'Job OCR iniciado.');
  run();
}

/**
 * Para o job OCR (cancela o timeout pendente).
 */
export function stopOcrJob() {
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
    logger.info({ msg: 'Job OCR parado.' });
  }
}
