import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import apiRouter from './routes/index.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);
app.use((_request, response) => response.status(404).json({ error: 'Route not found' }));

app.listen(port, '0.0.0.0', () => {
  console.log(`Powerbank Stock Product API listening on port ${port}`);
});
