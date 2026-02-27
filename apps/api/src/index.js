import express from 'express';
import { config } from './config/env.js';
import healthRouter from './routes/health.js';

const app = express();

app.use(healthRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(config.API_PORT, () => {
  console.log(`Server is running on http://localhost:${config.API_PORT}`);
});
