import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { gpsReadingSchema, gpsBatchSchema, trackingQuerySchema } from '../validators';

export const trackingRouter = Router();

trackingRouter.post('/ingest', async (req: Request, res: Response) => {
  const parsed = gpsReadingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const { vehicle_id, lat, lng, speed, heading, fuel_level, engine_temp, odometer, recorded_at } = parsed.data;
  const id = uuidv4();
  const result = await getPool().query(
    `INSERT INTO gps_readings (id, vehicle_id, lat, lng, speed, heading, fuel_level, engine_temp, odometer, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [id, vehicle_id, lat, lng, speed ?? null, heading ?? null, fuel_level ?? null, engine_temp ?? null, odometer ?? null, recorded_at ?? new Date().toISOString()]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

trackingRouter.post('/ingest/batch', async (req: Request, res: Response) => {
  const parsed = gpsBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const { readings } = parsed.data;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const r of readings) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO gps_readings (id, vehicle_id, lat, lng, speed, heading, fuel_level, engine_temp, odometer, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, r.vehicle_id, r.lat, r.lng, r.speed ?? null, r.heading ?? null, r.fuel_level ?? null, r.engine_temp ?? null, r.odometer ?? null, r.recorded_at ?? new Date().toISOString()]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: { ingested: readings.length } });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

trackingRouter.get('/:vehicleId', async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const query = trackingQuerySchema.safeParse(req.query);
  if (!query.success) {
    return res.status(400).json({ success: false, error: { message: query.error.errors } });
  }
  const { from, to, limit, offset } = query.data;

  let sql = 'SELECT * FROM gps_readings WHERE vehicle_id = $1';
  const params: any[] = [vehicleId];
  let idx = 2;

  if (from) {
    sql += ` AND recorded_at >= $${idx++}`;
    params.push(from);
  }
  if (to) {
    sql += ` AND recorded_at <= $${idx++}`;
    params.push(to);
  }
  sql += ` ORDER BY recorded_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
  params.push(limit, offset);

  const result = await getPool().query(sql, params);
  res.json({ success: true, data: result.rows });
});

trackingRouter.get('/:vehicleId/latest', async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const result = await getPool().query(
    'SELECT * FROM gps_readings WHERE vehicle_id = $1 ORDER BY recorded_at DESC LIMIT 1',
    [vehicleId]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'No readings found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});
