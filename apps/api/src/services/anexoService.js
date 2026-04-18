import { createHash, randomUUID } from 'node:crypto';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';
import { getStorageProvider } from '../storage/index.js';
import { addAttachmentJob } from '../queues/attachment.queue.js';
import { registrarEvento } from './auditoria.service.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const MIME_TO_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const ENTIDADE_TIPOS_VALIDOS = [
  'contas_pagar',
  'contas_receber',
  'movimentacoes_caixa',
  'investimentos',
  'metas',
];

/**
 * Calcula o SHA-256 de um Buffer.
 * @param {Buffer} buffer
 * @returns {string}
 */
function calcularHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Faz upload de um arquivo, persiste no banco e enfileira job de OCR.
 *
 * @param {{ usuarioId: string, file: { buffer: Buffer, originalname: string, mimetype: string, size: number }, requestId?: string }} params
 * @returns {Promise<object>} Registro `Anexo` criado
 */
export async function uploadAnexo({ usuarioId, file, requestId }) {
  const { buffer, originalname, mimetype, size } = file;

  if (!ALLOWED_MIMES.includes(mimetype)) {
    throw AppError.badRequest('Tipo de arquivo não permitido.');
  }

  const maxBytes = (config.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024;
  if (size > maxBytes) {
    throw AppError.badRequest(`Arquivo excede o tamanho máximo de ${config.MAX_UPLOAD_SIZE_MB || 10}MB.`);
  }

  const hash = calcularHash(buffer);
  const uuid = randomUUID();
  const ext = MIME_TO_EXT[mimetype] || 'bin';
  const nomeArquivo = `${uuid}.${ext}`;

  const storageProvider = getStorageProvider();
  const { storagePath, url } = await storageProvider.upload({ userId: usuarioId, fileId: uuid, ext, buffer, mimetype });

  try {
    const anexo = await prisma.anexo.create({
      data: {
        id: uuid,
        usuario_id: usuarioId,
        nome_original: originalname.slice(0, 255),
        nome_arquivo: nomeArquivo,
        mime_type: mimetype,
        tamanho_bytes: BigInt(size),
        storage_driver: config.STORAGE_DRIVER || 'local',
        storage_path: storagePath,
        url,
        hash_sha256: hash,
      },
    });

    await prisma.anexoOcrResultado.create({
      data: {
        anexo_id: uuid,
        status: 'UPLOADED',
      },
    });

    await addAttachmentJob({
      attachmentId: uuid,
      storagePath,
      mimeType: mimetype,
      triggeredBy: 'upload',
      requestedAt: new Date().toISOString(),
    });

    logger.info({ anexoId: uuid, usuarioId }, 'Anexo enviado e job BullMQ enfileirado.');

    registrarEvento({
      usuarioId,
      actorType: 'USER',
      eventType: 'create',
      eventAction: 'anexo_enviado',
      entityType: 'anexo',
      entityId: uuid,
      metadata: { mime_type: mimetype, tamanho_bytes: size },
      requestId,
      sucesso: true,
    });

    // Normaliza BigInt para Number antes do retorno (evita erro ao serializar JSON)
    return { ...anexo, tamanho_bytes: Number(anexo.tamanho_bytes) };

    return anexo;
  } catch (err) {
    await storageProvider.delete({ storagePath }).catch((delErr) =>
      logger.warn({ delErr, storagePath }, 'Falha no rollback do arquivo físico.'),
    );
    throw err;
  }
}

/**
 * Lista anexos do usuário com filtro opcional por entidade.
 *
 * @param {{ usuarioId: string, entidadeTipo?: string, entidadeId?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ data: object[], total: number, page: number, limit: number }>}
 */
export async function listarAnexos({ usuarioId, entidadeTipo, entidadeId, page = 1, limit = 20 }) {
  const skip = (page - 1) * limit;

  const where = {
    usuario_id: usuarioId,
    deleted_at: null,
  };

  if (entidadeTipo && entidadeId) {
    where.vinculos = {
      some: {
        entidade_tipo: entidadeTipo,
        entidade_id: entidadeId,
      },
    };
  } else if (entidadeTipo) {
    where.vinculos = {
      some: { entidade_tipo: entidadeTipo },
    };
  }

  const [data, total] = await Promise.all([
    prisma.anexo.findMany({
      where,
      include: {
        vinculos: true,
        ocr_resultado: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.anexo.count({ where }),
  ]);

  // Normaliza BigInt para Number para evitar erro ao serializar JSON
  const dataNormalized = data.map((a) => ({ ...a, tamanho_bytes: Number(a.tamanho_bytes) }));
  return { data: dataNormalized, total, page, limit };

  return { data, total, page, limit };
}

/**
 * Busca um anexo por ID validando ownership.
 *
 * @param {{ usuarioId: string, anexoId: string }} params
 * @returns {Promise<object>}
 */
export async function buscarAnexoPorId({ usuarioId, anexoId }) {
  const anexo = await prisma.anexo.findFirst({
    where: { id: anexoId, usuario_id: usuarioId, deleted_at: null },
    include: {
      vinculos: true,
      ocr_resultado: true,
    },
  });

    if (!anexo) {
    throw AppError.notFound('Anexo não encontrado.');
  }

  // Normaliza BigInt para Number antes de retornar
  return { ...anexo, tamanho_bytes: Number(anexo.tamanho_bytes) };
}

/**
 * Soft-delete de um anexo (não apaga o arquivo físico).
 *
 * @param {{ usuarioId: string, anexoId: string, requestId?: string }} params
 * @returns {Promise<object>}
 */
export async function deletarAnexo({ usuarioId, anexoId, requestId }) {
  const anexo = await prisma.anexo.findFirst({
    where: { id: anexoId, usuario_id: usuarioId, deleted_at: null },
  });

  if (!anexo) {
    throw AppError.notFound('Anexo não encontrado.');
  }

  const updated = await prisma.anexo.update({
    where: { id: anexoId },
    data: { deleted_at: new Date() },
  });

  logger.info({ anexoId, usuarioId }, 'Anexo removido (soft-delete).');

  registrarEvento({
    usuarioId,
    actorType: 'USER',
    eventType: 'delete',
    eventAction: 'anexo_excluido',
    entityType: 'anexo',
    entityId: anexoId,
    requestId,
    sucesso: true,
  });

  return updated;
}

/**
 * Cria um vínculo entre anexo e entidade financeira.
 *
 * @param {{ usuarioId: string, anexoId: string, entidadeTipo: string, entidadeId: string, requestId?: string }} params
 * @returns {Promise<object>}
 */
export async function vincularAnexo({ usuarioId, anexoId, entidadeTipo, entidadeId, requestId }) {
  if (!ENTIDADE_TIPOS_VALIDOS.includes(entidadeTipo)) {
    throw AppError.badRequest(`Tipo de entidade inválido. Permitidos: ${ENTIDADE_TIPOS_VALIDOS.join(', ')}.`);
  }

  const anexo = await prisma.anexo.findFirst({
    where: { id: anexoId, usuario_id: usuarioId, deleted_at: null },
  });

  if (!anexo) {
    throw AppError.notFound('Anexo não encontrado.');
  }

  const vinculo = await prisma.anexoVinculo.create({
    data: {
      anexo_id: anexoId,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
    },
  });

  logger.info({ anexoId, entidadeTipo, entidadeId }, 'Vínculo de anexo criado.');

  registrarEvento({
    usuarioId,
    actorType: 'USER',
    eventType: 'create',
    eventAction: 'anexo_vinculado',
    entityType: 'anexo_vinculo',
    entityId: anexoId,
    metadata: { entidade_tipo: entidadeTipo, entidade_id: entidadeId },
    requestId,
    sucesso: true,
  });

  return vinculo;
}

/**
 * Remove um vínculo entre anexo e entidade financeira.
 *
 * @param {{ usuarioId: string, anexoId: string, entidadeTipo: string, entidadeId: string }} params
 * @returns {Promise<void>}
 */
export async function desvincularAnexo({ usuarioId, anexoId, entidadeTipo, entidadeId }) {
  const anexo = await prisma.anexo.findFirst({
    where: { id: anexoId, usuario_id: usuarioId, deleted_at: null },
  });

  if (!anexo) {
    throw AppError.notFound('Anexo não encontrado.');
  }

  const vinculo = await prisma.anexoVinculo.findFirst({
    where: {
      anexo_id: anexoId,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
    },
  });

  if (!vinculo) {
    throw AppError.notFound('Vínculo não encontrado.');
  }

  await prisma.anexoVinculo.delete({ where: { id: vinculo.id } });
  logger.info({ anexoId, entidadeTipo, entidadeId }, 'Vínculo de anexo removido.');
}

/**
 * Obtém referência segura de download para um anexo.
 *
 * @param {{ usuarioId: string, anexoId: string }} params
 * @returns {Promise<{ url: string, fileName: string }>}
 */
export async function obterDownloadReference({ usuarioId, anexoId }) {
  const anexo = await buscarAnexoPorId({ usuarioId, anexoId });
  const storageProvider = getStorageProvider();
  const url = await storageProvider.getDownloadReference({ storagePath: anexo.storage_path });
  return { url, fileName: anexo.nome_original };
}

/**
 * Busca o resultado OCR de um anexo.
 *
 * @param {{ usuarioId: string, anexoId: string }} params
 * @returns {Promise<object>}
 */
export async function buscarOcrResultado({ usuarioId, anexoId }) {
  await buscarAnexoPorId({ usuarioId, anexoId });

  const ocr = await prisma.anexoOcrResultado.findUnique({
    where: { anexo_id: anexoId },
  });

  if (!ocr) {
    throw AppError.notFound('Resultado OCR não encontrado.');
  }

  return ocr;
}
