import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userOrIpKeyGenerator } from '../utils/rateLimitStore.js';
import {
  uploadAnexo,
  listarAnexos,
  buscarAnexoPorId,
  deletarAnexo,
  vincularAnexo,
  desvincularAnexo,
  buscarOcrResultado,
  obterDownloadReference,
} from '../services/anexoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../errors/AppError.js';
import logger from '../logger.js';
import { listAnexosQuerySchema, vinculoSchema, ocrConfirmarSchema } from '../schemas/anexo.schemas.js';
import { uuidParam } from '../schemas/shared.schemas.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

// ---------------------------------------------------------------------------
// POST /anexos — upload de arquivo
// ---------------------------------------------------------------------------
async function handleUpload(req, res, next) {
  try {
    const anexo = await uploadAnexo({
      usuarioId: req.user.sub,
      file: req.uploadedFile,
      requestId: req.requestId,
    });
    logger.info({ anexoId: anexo.id, userId: req.user.sub }, 'Anexo criado.');
    return res.status(201).json(anexo);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /anexos — listar anexos do usuário
// ---------------------------------------------------------------------------
async function handleList(req, res, next) {
  try {
    const { entidade_tipo, entidade_id, page, limit } = req.query;
    const result = await listarAnexos({
      usuarioId: req.user.sub,
      entidadeTipo: entidade_tipo,
      entidadeId: entidade_id,
      page,
      limit,
    });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /anexos/:id — buscar um anexo
// ---------------------------------------------------------------------------
async function handleGet(req, res, next) {
  try {
    const anexo = await buscarAnexoPorId({ usuarioId: req.user.sub, anexoId: req.params.id });
    return res.status(200).json(anexo);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /anexos/:id/download — referência segura de download
// ---------------------------------------------------------------------------
async function handleDownload(req, res, next) {
  try {
    const result = await obterDownloadReference({ usuarioId: req.user.sub, anexoId: req.params.id });
    logger.info({ anexoId: req.params.id, userId: req.user.sub }, 'Download reference gerada.');
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /anexos/:id — soft-delete
// ---------------------------------------------------------------------------
async function handleDelete(req, res, next) {
  try {
    await deletarAnexo({ usuarioId: req.user.sub, anexoId: req.params.id, requestId: req.requestId });
    logger.info({ anexoId: req.params.id, userId: req.user.sub }, 'Anexo removido.');
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /anexos/:id/vinculos — vincular a entidade
// ---------------------------------------------------------------------------
async function handleVincular(req, res, next) {
  try {
    const { entidade_tipo, entidade_id } = req.body;
    const vinculo = await vincularAnexo({
      usuarioId: req.user.sub,
      anexoId: req.params.id,
      entidadeTipo: entidade_tipo,
      entidadeId: entidade_id,
      requestId: req.requestId,
    });
    logger.info({ anexoId: req.params.id, userId: req.user.sub }, 'Vínculo criado.');
    return res.status(201).json(vinculo);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /anexos/:id/vinculos — desvincular de entidade
// ---------------------------------------------------------------------------
async function handleDesvincular(req, res, next) {
  try {
    const { entidade_tipo, entidade_id } = req.body;
    await desvincularAnexo({
      usuarioId: req.user.sub,
      anexoId: req.params.id,
      entidadeTipo: entidade_tipo,
      entidadeId: entidade_id,
    });
    logger.info({ anexoId: req.params.id, userId: req.user.sub }, 'Vínculo removido.');
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /anexos/:id/ocr — resultado do OCR
// ---------------------------------------------------------------------------
async function handleGetOcr(req, res, next) {
  try {
    const ocr = await buscarOcrResultado({ usuarioId: req.user.sub, anexoId: req.params.id });
    return res.status(200).json(ocr);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /anexos/:id/ocr/confirmar — confirmar/ajustar dados do OCR
// ---------------------------------------------------------------------------
async function handleOcrConfirmar(req, res, next) {
  try {
    const ocr = await buscarOcrResultado({ usuarioId: req.user.sub, anexoId: req.params.id });

    const confirmado = {
      ...ocr,
      ...req.body,
      confirmed: true,
    };

    logger.info({ anexoId: req.params.id, userId: req.user.sub }, 'Resultado OCR confirmado pelo usuário.');
    return res.status(200).json(confirmado);
  } catch (err) {
    return next(err);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
router.post('/anexos', writeLimiter, jwtAuthMiddleware, requireAtivo, uploadMiddleware, handleUpload);
router.get('/anexos', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ query: listAnexosQuerySchema }), handleList);
router.get('/anexos/:id/download', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleDownload);
router.get('/anexos/:id', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleGet);
router.delete('/anexos/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleDelete);
router.post('/anexos/:id/vinculos', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: vinculoSchema, params: uuidParam }), handleVincular);
router.delete('/anexos/:id/vinculos', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: vinculoSchema, params: uuidParam }), handleDesvincular);
router.get('/anexos/:id/ocr', readLimiter, jwtAuthMiddleware, requireAtivo, validate({ params: uuidParam }), handleGetOcr);
router.post('/anexos/:id/ocr/confirmar', writeLimiter, jwtAuthMiddleware, requireAtivo, validate({ body: ocrConfirmarSchema, params: uuidParam }), handleOcrConfirmar);

export default router;
