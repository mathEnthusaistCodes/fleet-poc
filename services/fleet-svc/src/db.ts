import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fleet:fleetpass@localhost:5432/fleet',
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id UUID PRIMARY KEY,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        license_plate VARCHAR(20) UNIQUE NOT NULL,
        vin VARCHAR(17) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        fuel_type VARCHAR(20) NOT NULL,
        fuel_capacity DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        phone VARCHAR(20) NOT NULL,
        license_number VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'available',
        assigned_vehicle_id UUID REFERENCES vehicles(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS routes (
        id UUID PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        vehicle_id UUID REFERENCES vehicles(id),
        driver_id UUID REFERENCES drivers(id),
        origin_lat DECIMAL(10,7) NOT NULL,
        origin_lng DECIMAL(10,7) NOT NULL,
        dest_lat DECIMAL(10,7) NOT NULL,
        dest_lng DECIMAL(10,7) NOT NULL,
        distance_km DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'planned',
        started_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

export function getPool(): Pool {
  return pool;
}
