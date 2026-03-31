import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';
import { config } from '../config/env.js';
import logger from '../logger.js';

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
 * Retorna o diretório base de uploads.
 * @returns {string}
 */
function uploadsDir() {
  return config.UPLOADS_DIR || './uploads';
}

/**
 * Faz upload de um arquivo, persiste no banco e enfileira job de OCR.
 *
 * @param {{ usuarioId: string, file: { buffer: Buffer, originalname: string, mimetype: string, size: number } }} params
 * @returns {Promise<object>} Registro `Anexo` criado
 */
export async function uploadAnexo({ usuarioId, file }) {
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

  const userDir = path.join(uploadsDir(), usuarioId);
  await mkdir(userDir, { recursive: true });

  const filePath = path.join(userDir, nomeArquivo);
  await writeFile(filePath, buffer);

  const url = `${userDir}/${nomeArquivo}`;

  const anexo = await prisma.anexo.create({
    data: {
      id: uuid,
      usuario_id: usuarioId,
      nome_original: originalname.slice(0, 255),
      nome_arquivo: nomeArquivo,
      mime_type: mimetype,
      tamanho_bytes: BigInt(size),
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

  await prisma.job.create({
    data: {
      tipo: 'ocr_processar',
      payload: { anexo_id: uuid, file_path: filePath, mime_type: mimetype },
      status: 'pendente',
      agendado_para: new Date(),
    },
  });

  logger.info({ anexoId: uuid, usuarioId }, 'Anexo enviado e job OCR enfileirado.');
  return anexo;
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

  return anexo;
}

/**
 * Soft-delete de um anexo (não apaga o arquivo físico).
 *
 * @param {{ usuarioId: string, anexoId: string }} params
 * @returns {Promise<object>}
 */
export async function deletarAnexo({ usuarioId, anexoId }) {
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
  return updated;
}

/**
 * Cria um vínculo entre anexo e entidade financeira.
 *
 * @param {{ usuarioId: string, anexoId: string, entidadeTipo: string, entidadeId: string }} params
 * @returns {Promise<object>}
 */
export async function vincularAnexo({ usuarioId, anexoId, entidadeTipo, entidadeId }) {
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
