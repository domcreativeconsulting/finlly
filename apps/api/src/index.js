import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import logger from './logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';

const app = express();

// ============================================================
// CORS — allow requests only from the configured frontend origin
// ============================================================
const allowedOrigin = config.APP_URL.replace(/\/$/, '');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count, X-Page-Number');
  res.setHeader('Access-Control-Max-Age', '3600');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// ============================================================
// Security headers
// ============================================================
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(healthRouter);
app.use(authRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info({ msg: `Server is running on http://localhost:${config.API_PORT}` });
});
