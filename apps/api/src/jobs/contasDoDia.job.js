/**
 * Daily bill summary job — WhatsApp Agent (Story 12.4 / 12.4.1).
 *
 * Fires once per day (configurable via CONTAS_DIA_JOB_HOUR_UTC, default 08:00 UTC).
 * Fetches all active users with WhatsApp linked and enqueues one BullMQ job per user
 * in the 'whatsapp-diario' queue. The worker handles the actual sending.
 *
 * Uses a setTimeout-based scheduler (same pattern as reconciliacao.job.js).
 * On startup, calculates the ms until the next scheduled run time.
 *
 * @module contasDoDia.job
 */

import { buscarUsuariosComWhatsapp } from '../services/contasPagarDiariaService.js';
import { addWhatsappDiarioJob } from '../queues/whatsappDiario.queue.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

let timeoutHandle = null;

/**
 * Calculates the milliseconds until the next scheduled run time (today or tomorrow at CONTAS_DIA_JOB_HOUR_UTC).
 * @returns {number}
 */
function msAteProximaExecucao() {
  const now = new Date();
  const hora = config.CONTAS_DIA_JOB_HOUR_UTC;
  const proxima = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hora, 0, 0, 0,
  ));
  if (proxima <= now) {
    proxima.setUTCDate(proxima.getUTCDate() + 1);
  }
  return proxima.getTime() - now.getTime();
}

/**
 * Enqueues a daily summary job for one user in the BullMQ queue.
 * Errors are caught individually so one failure doesn't abort the batch.
 * @param {{ id: string, nome: string, whatsapp: string }} usuario
 */
async function enfileirarUsuario(usuario) {
  try {
    await addWhatsappDiarioJob({
      usuarioId: usuario.id,
      nome: usuario.nome,
      whatsapp: usuario.whatsapp,
    });
    logger.info({ usuarioId: usuario.id }, 'Job contasDoDia: resumo enfileirado para usuário');
  } catch (err) {
    logger.error({ err, usuarioId: usuario.id }, 'Job contasDoDia: erro ao enfileirar resumo para usuário');
  }
}

/**
 * Main job execution: fetch all users and enqueue summary jobs.
 */
async function run() {
  logger.info('Job contasDoDia: iniciando agendamento de resumos diários');
  try {
    const usuarios = await buscarUsuariosComWhatsapp();
    logger.info({ total: usuarios.length }, 'Job contasDoDia: usuários com WhatsApp encontrados');
    for (const usuario of usuarios) {
      await enfileirarUsuario(usuario);
    }
    logger.info('Job contasDoDia: enfileiramento concluído');
  } catch (err) {
    logger.error({ err }, 'Erro no job contasDoDia');
  } finally {
    scheduleNext();
  }
}

/**
 * Schedules the next run.
 */
function scheduleNext() {
  const ms = msAteProximaExecucao();
  timeoutHandle = setTimeout(run, ms);
  logger.info({ proximaExecucaoMs: ms }, 'Job contasDoDia: próxima execução agendada');
}

/**
 * Starts the daily bill summary job.
 */
export function startContasDoDiaJob() {
  logger.info({ horaUTC: config.CONTAS_DIA_JOB_HOUR_UTC }, 'Job contasDoDia iniciado');
  scheduleNext();
}

/**
 * Stops the job (clears pending timeout).
 */
export function stopContasDoDiaJob() {
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle);
    timeoutHandle = null;
    logger.info('Job contasDoDia parado');
  }
}

