/**
 * Daily bill summary job — WhatsApp Agent (Story 12.4).
 *
 * Fires once per day (configurable via CONTAS_DIA_JOB_HOUR_UTC, default 08:00 UTC).
 * Fetches all active users with WhatsApp linked, queries their bills due today
 * and overdue bills, and sends a proactive summary via WhatsApp.
 *
 * Uses a setTimeout-based scheduler (same pattern as reconciliacao.job.js).
 * On startup, calculates the ms until the next scheduled run time.
 *
 * @module contasDoDia.job
 */

import { buscarUsuariosComWhatsapp, buscarContasDoDia } from '../services/contasPagarDiariaService.js';
import { replyResumoDiario } from '../lib/whatsapp/whatsappReplyBuilder.js';
import { sendTextMessage } from '../services/whatsappSenderService.js';
import { normalizePhoneNumber } from '../lib/whatsapp/evolutionPayloadParser.js';
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
 * Processes one user: fetches their bills and sends the summary.
 * Errors per user are caught individually so one failure doesn't abort the batch.
 * @param {{ id: string, nome: string, whatsapp: string }} usuario
 */
async function processarUsuario(usuario) {
  try {
    const { hoje, atrasadas } = await buscarContasDoDia(usuario.id);
    const texto = replyResumoDiario({
      nome: usuario.nome.split(' ')[0],
      contasHoje: hoje,
      contasAtrasadas: atrasadas,
    });
    await sendTextMessage({ telefone: normalizePhoneNumber(usuario.whatsapp), texto, usuarioId: usuario.id });
    logger.info({ usuarioId: usuario.id, contasHoje: hoje.length, atrasadas: atrasadas.length }, 'Resumo diário WhatsApp enviado');
  } catch (err) {
    logger.error({ err, usuarioId: usuario.id }, 'Erro ao enviar resumo diário WhatsApp para usuário');
  }
}

/**
 * Main job execution: fetch all users and send summaries.
 */
async function run() {
  logger.info('Job contasDoDia: iniciando envio de resumos diários');
  try {
    const usuarios = await buscarUsuariosComWhatsapp();
    logger.info({ total: usuarios.length }, 'Job contasDoDia: usuários com WhatsApp encontrados');
    for (const usuario of usuarios) {
      await processarUsuario(usuario);
    }
    logger.info('Job contasDoDia: envio concluído');
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
