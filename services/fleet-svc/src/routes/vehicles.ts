import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../db';
import { createVehicleSchema, updateVehicleSchema } from '../validators';

export const vehicleRouter = Router();

vehicleRouter.get('/', async (_req: Request, res: Response) => {
  const result = await getPool().query('SELECT * FROM vehicles ORDER BY created_at DESC');
  res.json({ success: true, data: result.rows });
});

vehicleRouter.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query('SELECT * FROM vehicles WHERE id = $1', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Vehicle not found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});

vehicleRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createVehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const { make, model, year, license_plate, vin, fuel_type, fuel_capacity } = parsed.data;
  const id = uuidv4();
  const result = await getPool().query(
    `INSERT INTO vehicles (id, make, model, year, license_plate, vin, fuel_type, fuel_capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [id, make, model, year, license_plate, vin, fuel_type, fuel_capacity]
  );
  res.status(201).json({ success: true, data: result.rows[0] });
});

vehicleRouter.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateVehicleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { message: parsed.error.errors } });
  }
  const fields = parsed.data;
  const setClauses: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }
  if (setClauses.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
  }
  setClauses.push(`updated_at = NOW()`);
  values.push(id);
  const query = `UPDATE vehicles SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;
  const result = await getPool().query(query, values);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Vehicle not found' } });
  }
  res.json({ success: true, data: result.rows[0] });
});

vehicleRouter.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await getPool().query('DELETE FROM vehicles WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: { message: 'Vehicle not found' } });
  }
  res.json({ success: true, data: { id } });
});
