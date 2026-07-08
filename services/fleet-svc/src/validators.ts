import { z } from 'zod';

export const createVehicleSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(2030),
  license_plate: z.string().min(1).max(20),
  vin: z.string().length(17),
  fuel_type: z.enum(['diesel', 'gasoline', 'electric', 'hybrid']),
  fuel_capacity: z.number().positive(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export const createDriverSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().min(10).max(20),
  license_number: z.string().min(1).max(50),
});

export const createRouteSchema = z.object({
  name: z.string().min(1).max(200),
  vehicle_id: z.string().uuid(),
  driver_id: z.string().uuid(),
  origin_lat: z.number(),
  origin_lng: z.number(),
  dest_lat: z.number(),
  dest_lng: z.number(),
  distance_km: z.number().positive(),
});
