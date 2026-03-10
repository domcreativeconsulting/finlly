import express from 'express';
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

const app = express();

app.use(corsMiddleware);
app.use(securityHeaders);
app.use(express.json());
app.use(cookieParser());
app.use(csrfProtection);
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(healthRouter);
app.use(authRouter);
app.use(perfilRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info({ msg: `Server is running on http://localhost:${config.API_PORT}` });
});
