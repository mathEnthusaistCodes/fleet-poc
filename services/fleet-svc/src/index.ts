import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import { vehicleRouter } from './routes/vehicles';
import { driverRouter } from './routes/drivers';
import { routeRouter } from './routes/routes';

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.use('/api/vehicles', vehicleRouter);
app.use('/api/drivers', driverRouter);
app.use('/api/routes', routeRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fleet-svc' });
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
      console.log(`fleet-svc running on port ${PORT}`);
    });
  })();
}

export default app;
