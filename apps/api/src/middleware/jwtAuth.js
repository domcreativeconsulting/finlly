import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

/**
 * Extracts the Bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function extractBearerToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Middleware that validates the access JWT and attaches `req.user`.
 * @type {import('express').RequestHandler}
 */
export function jwtAuthMiddleware(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) return next(AppError.unauthorized('Token ausente'));

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return next(AppError.unauthorized('Token inválido'));
  }
}
