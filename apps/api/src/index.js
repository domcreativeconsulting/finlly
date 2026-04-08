import express from 'express';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { config } from './config/env.js';
import logger from './logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { sanitizeResponse } from './middleware/sanitizeResponse.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import { AppError } from './errors/AppError.js';
import { buildStore } from './utils/rateLimitStore.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import perfilRouter from './routes/perfil.js';
import billingRouter from './routes/billing.js';
import { startReconciliacaoJob } from './jobs/reconciliacao.job.js';
import { startOcrJob } from './jobs/ocr.job.js';
import { startContasDoDiaJob } from './jobs/contasDoDia.job.js';
import contasPagarRouter from './routes/contasPagar.js';
import contasReceberRouter from './routes/contasReceber.js';
import categoriasRouter from './routes/categorias.js';
import contasRouter from './routes/contas.js';
import movimentacoesRouter from './routes/movimentacoes.js';
import cashMovementsRouter from './routes/cashMovements.js';
import investimentosRouter from './routes/investimentos.js';
import metasRouter from './routes/metas.js';
import anexosRouter from './routes/anexos.js';
import whatsappRouter from './routes/whatsapp.js';
import dashboardRouter from './routes/dashboard.js';
import lgpdRouter from './routes/lgpd.js';

const app = express();

app.disable('x-powered-by');

/** Global safety-net rate limiter: configurable via RATE_LIMIT_MAX / RATE_LIMIT_WINDOW_MS. */
const globalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  skip: () => config.NODE_ENV === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  store: buildStore(config.RATE_LIMIT_WINDOW_MS),
  message: { code: 'RATE_LIMITED', message: 'Muitas requisições. Tente novamente mais tarde.' },
  handler: (req, res, next, options) => {
    logger.warn({ msg: 'Global rate limit atingido', ip: req.ip, path: req.path });
    return next(AppError.tooManyRequests(options.message.message));
  },
});

app.use(corsMiddleware);
app.use(securityHeaders);
app.use(globalLimiter);
app.use(sanitizeResponse);

// Apply raw body parsing for the webhook path before express.json(),
// so the raw bytes are preserved for HMAC signature verification.
app.use('/webhooks/asaas', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(healthRouter);
app.use(authRouter);
app.use(perfilRouter);
app.use(billingRouter);
app.use(contasPagarRouter);
app.use(contasReceberRouter);
app.use(categoriasRouter);
app.use(contasRouter);
app.use(movimentacoesRouter);
app.use(cashMovementsRouter);
app.use(investimentosRouter);
app.use(metasRouter);
app.use(anexosRouter);
app.use(whatsappRouter);
app.use(dashboardRouter);
app.use(lgpdRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info({
    msg: `Server is running on http://localhost:${config.API_PORT}`,
  });
  if (config.NODE_ENV !== 'test') {
    startReconciliacaoJob();
    startOcrJob();
    startContasDoDiaJob();
  }
});
