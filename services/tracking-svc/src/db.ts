import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fleet:fleetpass@localhost:5432/fleet',
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS gps_readings (
        id UUID PRIMARY KEY,
        vehicle_id UUID NOT NULL,
        lat DECIMAL(10,7) NOT NULL,
        lng DECIMAL(10,7) NOT NULL,
        speed DECIMAL(10,2),
        heading DECIMAL(5,2),
        fuel_level DECIMAL(5,2),
        engine_temp DECIMAL(5,2),
        odometer DECIMAL(10,2),
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_readings(vehicle_id, recorded_at DESC);
    `);
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  return pool;
}
