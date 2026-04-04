/**
 * BullMQ Worker — Daily WhatsApp bill summary (Story 12.4.1).
 *
 * Consumes the 'whatsapp-diario' queue. Each job sends one user's
 * proactive daily bill summary via WhatsApp.
 */
import { Worker } from 'bullmq';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { buscarContasDoDia } from '../services/contasPagarDiariaService.js';
import { replyResumoDiario } from '../lib/whatsapp/whatsappReplyBuilder.js';
import { sendTextMessage } from '../services/whatsappSenderService.js';
import { normalizePhoneNumber } from '../lib/whatsapp/evolutionPayloadParser.js';
import { WHATSAPP_DIARIO_QUEUE_NAME } from '../queues/whatsappDiario.queue.js';

const connection = { url: config.REDIS_URL };

const worker = new Worker(
  WHATSAPP_DIARIO_QUEUE_NAME,
  async (job) => {
    const { usuarioId, nome, whatsapp } = job.data;

    logger.info({ usuarioId, jobId: String(job.id) }, 'Worker whatsappDiario: iniciando envio de resumo');

    const { hoje, atrasadas } = await buscarContasDoDia(usuarioId);
    const texto = replyResumoDiario({
      nome: nome.split(' ')[0],
      contasHoje: hoje,
      contasAtrasadas: atrasadas,
    });

    const result = await sendTextMessage({
      telefone: normalizePhoneNumber(whatsapp),
      texto,
      usuarioId,
    });

    logger.info(
      { usuarioId, jobId: String(job.id), contasHoje: hoje.length, atrasadas: atrasadas.length, status: result.status },
      'Worker whatsappDiario: resumo enviado',
    );

    return { usuarioId, status: result.status, contasHoje: hoje.length, atrasadas: atrasadas.length };
  },
  {
    connection,
    concurrency: config.WHATSAPP_DIARIO_WORKER_CONCURRENCY,
  },
);

worker.on('failed', (job, err) => {
  logger.error(
    { usuarioId: job?.data?.usuarioId, jobId: String(job?.id || 'unknown'), attempts: job?.attemptsMade, err },
    job?.attemptsMade >= job?.opts?.attempts
      ? 'Worker whatsappDiario: job falhou definitivamente'
      : 'Worker whatsappDiario: job falhou, será reprocessado',
  );
});

worker.on('error', (err) => {
  logger.error({ err }, 'Worker whatsappDiario: erro interno do BullMQ');
});

async function shutdown() {
  logger.info('Worker whatsappDiario encerrando...');
  await worker.close();
  logger.info('Worker whatsappDiario encerrado.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info(
  { queue: WHATSAPP_DIARIO_QUEUE_NAME, concurrency: config.WHATSAPP_DIARIO_WORKER_CONCURRENCY },
  'Worker whatsappDiario iniciado.',
);
