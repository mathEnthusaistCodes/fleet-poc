import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { createDriverSchema } from '../validators';

export const driverRouter = Router();

driverRouter.get('/', async (_req: Request, res: Response) => {
  const result = await getPool().query('SELECT * FROM drivers ORDER BY created_at DESC');
  res.json({ success: true, data: result.rows });
});

driverRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query('SELECT * FROM drivers WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Driver not found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});

driverRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createDriverSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const { name, email, phone, license_number } = parsed.data;
  const id = uuidv4();
  const result = await getPool().query(
    `INSERT INTO drivers (id, name, email, phone, license_number)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, name, email, phone, license_number]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

driverRouter.patch('/:id/assign', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { vehicle_id } = req.body;
  const result = await getPool().query(
    `UPDATE drivers SET assigned_vehicle_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [vehicle_id, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Driver not found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});
