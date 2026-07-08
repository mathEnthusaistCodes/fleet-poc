import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fleet:fleetpass@localhost:5432/fleet',
});

export function getPool(): Pool {
  return pool;
}
