import express from 'express';
import { config } from './config/env.js';
import logger from './logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import usuariosRouter from './routes/usuarios.js';

const app = express();

app.use(express.json());
app.use(requestIdMiddleware);
app.use(requestLogger);

app.use(healthRouter);
app.use(usuariosRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info({ msg: `Server is running on http://localhost:${config.API_PORT}` });
});
