import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import { trackingRouter } from './routes/tracking';

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

app.use('/api/tracking', trackingRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'tracking-svc' });
});

if (process.env.NODE_ENV !== 'test') {
  (async function start() {
    for (let i = 0; i < 30; i++) {
      try {
        await initDb();
        break;
      } catch (err) {
        console.log(`Waiting for database (attempt ${i + 1}/30)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    app.listen(PORT, () => {
      console.log(`tracking-svc running on port ${PORT}`);
    });
  })();
}

export default app;
