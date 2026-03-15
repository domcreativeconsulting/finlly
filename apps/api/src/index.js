import express from 'express';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { config } from './config/env.js';
import logger from './logger.js';
import { corsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import perfilRouter from './routes/perfil.js';
import billingRouter from './routes/billing.js';

const app = express();

app.use(corsMiddleware);
app.use(securityHeaders);

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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info({
    msg: `Server is running on http://localhost:${config.API_PORT}`,
  });
});
