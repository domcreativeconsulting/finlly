import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadAnexo, listarAnexos, deletarAnexo } from '../services/anexosService.js';
import { jwtAuthMiddleware } from '../middleware/jwtAuth.js';
import { requireAtivo } from '../middleware/requireAtivo.js';
import logger from '../logger.js';

const router = Router();

const UPLOADS_DIR = 'uploads/';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente mais tarde.' },
});

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, GIF, WEBP ou PDF.'));
    }
  },
});

async function handleUploadAnexo(req, res, next) {
  if (!req.file) {
    const { AppError } = await import('../errors/AppError.js');
    return next(AppError.badRequest('Nenhum arquivo enviado'));
  }
  try {
    const anexo = await uploadAnexo(req.user.sub, req.file, 'contas_pagar', req.params.id);
    logger.info({ msg: 'Anexo criado', userId: req.user.sub, anexoId: anexo.id, contaId: req.params.id });
    return res.status(201).json(anexo);
  } catch (err) {
    return next(err);
  }
}

async function handleListarAnexos(req, res, next) {
  try {
    const anexos = await listarAnexos(req.user.sub, 'contas_pagar', req.params.id);
    return res.status(200).json(anexos);
  } catch (err) {
    return next(err);
  }
}

async function handleDeletarAnexo(req, res, next) {
  try {
    await deletarAnexo(req.user.sub, req.params.id);
    logger.info({ msg: 'Anexo removido', userId: req.user.sub, anexoId: req.params.id });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

router.post(
  '/contas-pagar/:id/anexos',
  writeLimiter,
  jwtAuthMiddleware,
  requireAtivo,
  upload.single('arquivo'),
  handleUploadAnexo,
);

router.get(
  '/contas-pagar/:id/anexos',
  readLimiter,
  jwtAuthMiddleware,
  requireAtivo,
  handleListarAnexos,
);

router.delete(
  '/anexos/:id',
  writeLimiter,
  jwtAuthMiddleware,
  requireAtivo,
  handleDeletarAnexo,
);

export default router;
