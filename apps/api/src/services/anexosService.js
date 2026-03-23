import fs from 'fs';
import path from 'path';
import prisma from '../utils/database.js';
import { AppError } from '../errors/AppError.js';

const UPLOADS_DIR = path.resolve('uploads');

/**
 * Upload an attachment and link it to an entity.
 * The file is already saved to disk by multer; this function creates the
 * database records (`Anexo` + `AnexoVinculo`).
 * @param {string} userId
 * @param {import('multer').File} file
 * @param {string} entidadeTipo - e.g. 'contas_pagar'
 * @param {string} entidadeId
 * @returns {Promise<object>} The created Anexo record
 */
export async function uploadAnexo(userId, file, entidadeTipo, entidadeId) {
  const url = path.join('uploads', file.filename).replace(/\\/g, '/');

  const anexo = await prisma.anexo.create({
    data: {
      usuario_id: userId,
      nome_original: file.originalname,
      nome_arquivo: file.filename,
      mime_type: file.mimetype,
      tamanho_bytes: file.size,
      url,
    },
  });

  await prisma.anexoVinculo.create({
    data: {
      anexo_id: anexo.id,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
    },
  });

  return { ...anexo, tamanho_bytes: Number(anexo.tamanho_bytes) };
}

/**
 * List attachments linked to an entity.
 * @param {string} userId
 * @param {string} entidadeTipo
 * @param {string} entidadeId
 * @returns {Promise<object[]>}
 */
export async function listarAnexos(userId, entidadeTipo, entidadeId) {
  const vinculos = await prisma.anexoVinculo.findMany({
    where: {
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      anexo: { usuario_id: userId, deleted_at: null },
    },
    include: {
      anexo: true,
    },
    orderBy: { created_at: 'asc' },
  });

  return vinculos.map((v) => ({
    ...v.anexo,
    tamanho_bytes: Number(v.anexo.tamanho_bytes),
  }));
}

/**
 * Soft-delete an attachment and remove the physical file from disk.
 * @param {string} userId
 * @param {string} anexoId
 * @returns {Promise<void>}
 */
export async function deletarAnexo(userId, anexoId) {
  const anexo = await prisma.anexo.findFirst({
    where: { id: anexoId, usuario_id: userId, deleted_at: null },
  });

  if (!anexo) throw AppError.notFound('Anexo não encontrado');

  await prisma.anexo.update({
    where: { id: anexoId },
    data: { deleted_at: new Date() },
  });

  const filePath = path.resolve(UPLOADS_DIR, path.basename(anexo.nome_arquivo));
  if (!filePath.startsWith(UPLOADS_DIR + path.sep) && filePath !== UPLOADS_DIR) {
    // Resolved path escapes uploads directory — skip deletion for safety
    return;
  }
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore file removal errors — record is already soft-deleted
  }
}
