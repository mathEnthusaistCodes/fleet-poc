import { z } from 'zod';

export const gpsReadingSchema = z.object({
  vehicle_id: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  fuel_level: z.number().min(0).max(100).optional(),
  engine_temp: z.number().min(0).max(150).optional(),
  odometer: z.number().min(0).optional(),
  recorded_at: z.string().datetime().optional(),
});

export const gpsBatchSchema = z.object({
  readings: z.array(gpsReadingSchema).min(1).max(1000),
});

export const trackingQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(1000),
  offset: z.coerce.number().int().min(0).default(0),
});
