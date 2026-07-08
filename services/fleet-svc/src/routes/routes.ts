import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { createRouteSchema } from '../validators';

export const routeRouter = Router();

routeRouter.get('/', async (_req: Request, res: Response) => {
  const result = await getPool().query('SELECT * FROM routes ORDER BY created_at DESC');
  res.json({ success: true, data: result.rows });
});

routeRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query('SELECT * FROM routes WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Route not found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});

routeRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createRouteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const { name, vehicle_id, driver_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km } = parsed.data;
  const id = uuidv4();
  const result = await getPool().query(
    `INSERT INTO routes (id, name, vehicle_id, driver_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [id, name, vehicle_id, driver_id, origin_lat, origin_lng, dest_lat, dest_lng, distance_km]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

routeRouter.patch('/:id/start', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query(
    `UPDATE routes SET status = 'in_progress', started_at = NOW() WHERE id = $1 AND status = 'planned' RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Route cannot be started' } });
  }
  res.json({ success: true, data: result.rows[0] });
});

routeRouter.patch('/:id/complete', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query(
    `UPDATE routes SET status = 'completed', completed_at = NOW() WHERE id = $1 AND status = 'in_progress' RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'Route cannot be completed' } });
  }
  res.json({ success: true, data: result.rows[0] });
});
