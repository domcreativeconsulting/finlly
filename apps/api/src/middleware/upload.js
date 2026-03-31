import multer from 'multer';
import { config } from '../config/env.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Middleware de upload multipart/form-data usando multer.
 * Expõe `req.uploadedFile = { buffer, originalname, mimetype, size }`.
 * Limita tamanho a MAX_UPLOAD_SIZE_MB (padrão: 10MB).
 * Aceita apenas: image/jpeg, image/png, image/webp, application/pdf.
 */
const storage = multer.memoryStorage();

const limits = {
  fileSize: (config.MAX_UPLOAD_SIZE_MB || 10) * 1024 * 1024,
};

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Tipo de arquivo não permitido.'), { code: 'INVALID_MIME_TYPE' }), false);
  }
}

const upload = multer({ storage, limits, fileFilter });

/**
 * Middleware de upload: aceita campo `file` (binário).
 * Após processamento, expõe `req.uploadedFile`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function uploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          code: 'FILE_TOO_LARGE',
          message: `Arquivo excede o tamanho máximo de ${config.MAX_UPLOAD_SIZE_MB || 10}MB.`,
        });
      }
      if (err.code === 'INVALID_MIME_TYPE') {
        return res.status(400).json({
          code: 'INVALID_MIME_TYPE',
          message: err.message,
        });
      }
      return res.status(400).json({
        code: 'UPLOAD_ERROR',
        message: err.message || 'Erro ao processar o arquivo.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        code: 'MISSING_FILE',
        message: 'Nenhum arquivo enviado. Use o campo "file".',
      });
    }

    req.uploadedFile = {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    };

    next();
  });
}
