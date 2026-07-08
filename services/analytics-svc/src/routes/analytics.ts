import { Router, Request, Response } from 'express';
import { getPool } from '../db';
import { getCached, setCache, invalidateCache } from '../cache';
import { recordCacheAccess } from './loadtest';

export const analyticsRouter = Router();

analyticsRouter.get('/summary', async (_req: Request, res: Response) => {
  const cacheKey = 'analytics:summary';
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    recordCacheAccess(true);
    return res.json({ success: true, data: cached, cached: true });
  }

  const [vehiclesResult, activeResult, fuelResult, distResult, readingsResult] = await Promise.all([
    getPool().query('SELECT COUNT(*)::int as total FROM vehicles'),
    getPool().query("SELECT COUNT(*)::int as active FROM vehicles WHERE status = 'active'"),
    getPool().query('SELECT AVG(fuel_capacity)::float as avg_fuel FROM vehicles'),
    getPool().query('SELECT COALESCE(AVG(distance_km), 0)::float as avg_distance FROM routes WHERE status = $1', ['completed']),
    getPool().query('SELECT COUNT(*)::int as total_readings FROM gps_readings'),
  ]);

  const data = {
    total_vehicles: vehiclesResult.rows[0].total,
    active_vehicles: activeResult.rows[0].active,
    avg_fuel_capacity: Math.round(fuelResult.rows[0].avg_fuel * 100) / 100,
    avg_route_distance: Math.round(distResult.rows[0].avg_distance * 100) / 100,
    total_gps_readings: readingsResult.rows[0].total_readings,
    generated_at: new Date().toISOString(),
  };

  await setCache(cacheKey, data);
  recordCacheAccess(false);
  res.json({ success: true, data, cached: false });
});

analyticsRouter.get('/vehicle/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const cacheKey = `analytics:vehicle:${id}`;

  const cached = await getCached<any>(cacheKey);
  if (cached) {
    recordCacheAccess(true);
    return res.json({ success: true, data: cached, cached: true });
  }

  const [vehicleResult, readingStats, routeHistory] = await Promise.all([
    getPool().query('SELECT * FROM vehicles WHERE id = $1', [id]),
    getPool().query(
      `SELECT
        COUNT(*)::int as total_readings,
        AVG(speed)::float as avg_speed,
        MAX(speed)::float as max_speed,
        AVG(fuel_level)::float as avg_fuel_level
       FROM gps_readings WHERE vehicle_id = $1`,
      [id]
    ),
    getPool().query(
      `SELECT COUNT(*)::int as total_routes,
        COALESCE(AVG(distance_km), 0)::float as avg_distance,
        COALESCE(SUM(distance_km), 0)::float as total_distance
       FROM routes WHERE vehicle_id = $1`,
      [id]
    ),
  ]);

  if (vehicleResult.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Vehicle not found' } });
  }

  const data = {
    vehicle: vehicleResult.rows[0],
    tracking: readingStats.rows[0],
    routes: routeHistory.rows[0],
    generated_at: new Date().toISOString(),
  };

  await setCache(cacheKey, data);
  recordCacheAccess(false);
  res.json({ success: true, data, cached: false });
});

analyticsRouter.get('/fleet/utilization', async (_req: Request, res: Response) => {
  const cacheKey = 'analytics:utilization';
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    recordCacheAccess(true);
    return res.json({ success: true, data: cached, cached: true });
  }

  const result = await getPool().query(`
    SELECT
      v.id, v.make, v.model, v.status,
      COUNT(r.id)::int as total_routes,
      COALESCE(SUM(r.distance_km), 0)::float as total_distance,
      COUNT(r.id) FILTER (WHERE r.status = 'in_progress')::int as active_routes
    FROM vehicles v
    LEFT JOIN routes r ON r.vehicle_id = v.id
    GROUP BY v.id, v.make, v.model, v.status
  `);

  const data = { vehicles: result.rows, generated_at: new Date().toISOString() };
  await setCache(cacheKey, data);
  recordCacheAccess(false);
  res.json({ success: true, data, cached: false });
});

analyticsRouter.get('/refresh', async (_req: Request, res: Response) => {
  await invalidateCache('analytics:*');
  res.json({ success: true, data: { message: 'Cache cleared' } });
});
