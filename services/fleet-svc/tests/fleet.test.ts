import request from 'supertest';
import app from '../src/index';

jest.mock('../src/db', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
  };
  return { initDb: jest.fn(), getPool: () => mockPool };
});

import { getPool } from '../src/db';
const mockQuery = getPool().query as jest.Mock;

describe('Fleet Service - Vehicles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/vehicles returns list', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc', make: 'Toyota' }] });
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('GET /api/vehicles/:id returns 404 for missing', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/vehicles/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/vehicles creates a vehicle', async () => {
    const vehicle = {
      make: 'Toyota', model: 'Camry', year: 2023,
      license_plate: 'ABC-123', vin: '1HGCM82633A004352',
      fuel_type: 'gasoline', fuel_capacity: 60,
    };
    mockQuery.mockResolvedValue({ rows: [{ id: 'new-id', ...vehicle }] });
    const res = await request(app).post('/api/vehicles').send(vehicle);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/vehicles validates input', async () => {
    const res = await request(app).post('/api/vehicles').send({});
    expect(res.status).toBe(400);
  });

  it('PUT /api/vehicles/:id updates vehicle', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc', make: 'Honda' }] });
    const res = await request(app).put('/api/vehicles/abc').send({ make: 'Honda' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/vehicles/:id deletes vehicle', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'abc' }] });
    const res = await request(app).delete('/api/vehicles/abc');
    expect(res.status).toBe(200);
  });
});

describe('Fleet Service - Drivers', () => {
  it('POST /api/drivers creates a driver', async () => {
    const driver = {
      name: 'John Doe', email: 'john@example.com',
      phone: '1234567890', license_number: 'DL-12345',
    };
    mockQuery.mockResolvedValue({ rows: [{ id: 'driver-1', ...driver }] });
    const res = await request(app).post('/api/drivers').send(driver);
    expect(res.status).toBe(201);
  });

  it('POST /api/drivers validates email', async () => {
    const res = await request(app).post('/api/drivers').send({
      name: 'John', email: 'bad-email', phone: '123', license_number: 'X',
    });
    expect(res.status).toBe(400);
  });
});

describe('Fleet Service - Routes', () => {
  it('POST /api/routes creates a route', async () => {
    const route = {
      name: 'Route 1',
      vehicle_id: '00000000-0000-0000-0000-000000000001',
      driver_id: '00000000-0000-0000-0000-000000000002',
      origin_lat: 40.7128, origin_lng: -74.0060,
      dest_lat: 34.0522, dest_lng: -118.2437,
      distance_km: 3944,
    };
    mockQuery.mockResolvedValue({ rows: [{ id: 'route-1', ...route }] });
    const res = await request(app).post('/api/routes').send(route);
    expect(res.status).toBe(201);
  });
});
