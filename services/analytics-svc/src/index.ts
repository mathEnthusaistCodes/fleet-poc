import express from 'express';
import cors from 'cors';
import { getPool } from './db';
import { analyticsRouter } from './routes/analytics';
import { loadtestRouter, recordCacheAccess } from './routes/loadtest';

const app = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

app.use('/api/analytics', analyticsRouter);
app.use('/api/analytics/loadtest', loadtestRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'analytics-svc' });
});

if (process.env.NODE_ENV !== 'test') {
  (async function start() {
    for (let i = 0; i < 30; i++) {
      try {
        const client = await getPool().connect();
        await client.query(`
          CREATE TABLE IF NOT EXISTS vehicles (id UUID PRIMARY KEY, make VARCHAR(100) NOT NULL, model VARCHAR(100) NOT NULL, year INTEGER NOT NULL, license_plate VARCHAR(20) UNIQUE NOT NULL, vin VARCHAR(17) UNIQUE NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'active', fuel_type VARCHAR(20) NOT NULL, fuel_capacity DECIMAL(10,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
          CREATE TABLE IF NOT EXISTS routes (id UUID PRIMARY KEY, name VARCHAR(200) NOT NULL, vehicle_id UUID REFERENCES vehicles(id), driver_id UUID REFERENCES drivers(id), origin_lat DECIMAL(10,7) NOT NULL, origin_lng DECIMAL(10,7) NOT NULL, dest_lat DECIMAL(10,7) NOT NULL, dest_lng DECIMAL(10,7) NOT NULL, distance_km DECIMAL(10,2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'planned', started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW());
          CREATE TABLE IF NOT EXISTS gps_readings (id UUID PRIMARY KEY, vehicle_id UUID NOT NULL, lat DECIMAL(10,7) NOT NULL, lng DECIMAL(10,7) NOT NULL, speed DECIMAL(10,2), heading DECIMAL(5,2), fuel_level DECIMAL(5,2), engine_temp DECIMAL(5,2), odometer DECIMAL(10,2), recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
        `);
        client.release();
        break;
      } catch (err) {
        console.log(`Waiting for database (attempt ${i + 1}/30)...`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    app.listen(PORT, () => {
      console.log(`analytics-svc running on port ${PORT}`);
    });
  })();
}

export default app;
