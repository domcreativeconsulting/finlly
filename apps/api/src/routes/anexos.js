import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import {
  uploadAnexo,
  listarAnexos,
  buscarAnexoPorId,
  deletarAnexo,
  vincularAnexo,
  desvincularAnexo,
  buscarOcrResultado,
} from '../services/anexoService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import { uploadMiddleware } from '../middleware/upload.js';
import { AppError } from '../errors/AppError.js';
import { toValidationError } from '../errors/toValidationError.js';
import logger from '../logger.js';

const router = Router();

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => next(AppError.tooManyRequests(options.message.message)),
});

const ENTIDADE_TIPOS = ['contas_pagar', 'contas_receber', 'movimentacoes_caixa', 'investimentos', 'metas'];

const ListQuerySchema = z.object({
  entidade_tipo: z.enum(ENTIDADE_TIPOS).optional(),
  entidade_id: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const VinculoSchema = z.object({
  entidade_tipo: z.enum(ENTIDADE_TIPOS),
  entidade_id: z.string().uuid(),
});

const OcrConfirmarSchema = z.object({
  extracted_amount: z.number().nullable().optional(),
  extracted_date: z.string().nullable().optional(),
  extracted_description: z.string().max(500).nullable().optional(),
  extracted_type: z.string().max(50).nullable().optional(),
});

// ---------------------------------------------------------------------------
// POST /anexos — upload de arquivo
// ---------------------------------------------------------------------------
async function handleUpload(req, res, next) {
  try {
    const anexo = await uploadAnexo({
      usuarioId: req.user.sub,
      file: req.uploadedFile,
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
  const parsed = ListQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const result = await listarAnexos({
      usuarioId: req.user.sub,
      entidadeTipo: parsed.data.entidade_tipo,
      entidadeId: parsed.data.entidade_id,
      page: parsed.data.page,
      limit: parsed.data.limit,
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
// DELETE /anexos/:id — soft-delete
// ---------------------------------------------------------------------------
async function handleDelete(req, res, next) {
  try {
    await deletarAnexo({ usuarioId: req.user.sub, anexoId: req.params.id });
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
  const parsed = VinculoSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const vinculo = await vincularAnexo({
      usuarioId: req.user.sub,
      anexoId: req.params.id,
      entidadeTipo: parsed.data.entidade_tipo,
      entidadeId: parsed.data.entidade_id,
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
  const parsed = VinculoSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    await desvincularAnexo({
      usuarioId: req.user.sub,
      anexoId: req.params.id,
      entidadeTipo: parsed.data.entidade_tipo,
      entidadeId: parsed.data.entidade_id,
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
  const parsed = OcrConfirmarSchema.safeParse(req.body);
  if (!parsed.success) return next(toValidationError(parsed.error));

  try {
    const ocr = await buscarOcrResultado({ usuarioId: req.user.sub, anexoId: req.params.id });

    // Merge user-adjusted fields with the stored OCR result and return the
    // confirmed suggestion. This is intentionally NOT persisted as a financial
    // record — the client must explicitly create the entity using this data.
    const confirmado = {
      ...ocr,
      ...parsed.data,
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
router.get('/anexos', readLimiter, jwtAuthMiddleware, requireAtivo, handleList);
router.get('/anexos/:id', readLimiter, jwtAuthMiddleware, requireAtivo, handleGet);
router.delete('/anexos/:id', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDelete);
router.post('/anexos/:id/vinculos', writeLimiter, jwtAuthMiddleware, requireAtivo, handleVincular);
router.delete('/anexos/:id/vinculos', writeLimiter, jwtAuthMiddleware, requireAtivo, handleDesvincular);
router.get('/anexos/:id/ocr', readLimiter, jwtAuthMiddleware, requireAtivo, handleGetOcr);
router.post('/anexos/:id/ocr/confirmar', writeLimiter, jwtAuthMiddleware, requireAtivo, handleOcrConfirmar);

export default router;
