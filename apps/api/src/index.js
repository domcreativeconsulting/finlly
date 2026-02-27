import express from 'express';
import { config } from './config/env.js';
import { logger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { loggerMiddleware } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(requestIdMiddleware);
app.use(loggerMiddleware);

app.use(healthRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.use(errorHandler);

app.listen(config.API_PORT, () => {
  logger.info(`Server is running on http://localhost:${config.API_PORT}`);
});
