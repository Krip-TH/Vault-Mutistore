import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import apiRouter from './routes/index.js';

const app = express();
const port = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3000);

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' } });
    return;
  }
  console.error('Unhandled API error:', error);
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unable to process the request.' } });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Moodeng MultiStore API listening on port ${port}`);
});
