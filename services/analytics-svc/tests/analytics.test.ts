import request from 'supertest';
import app from '../src/index';

jest.mock('../src/db', () => {
  const mockPool = { query: jest.fn() };
  return { getPool: () => mockPool };
});

jest.mock('../src/cache', () => ({
  getCached: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import { getPool } from '../src/db';
const mockQuery = getPool().query as jest.Mock;

describe('Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/analytics/summary returns aggregated data', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 10 }] })
      .mockResolvedValueOnce({ rows: [{ active: 7 }] })
      .mockResolvedValueOnce({ rows: [{ avg_fuel: 55.5 }] })
      .mockResolvedValueOnce({ rows: [{ avg_distance: 120 }] })
      .mockResolvedValueOnce({ rows: [{ total_readings: 5000 }] });

    const res = await request(app).get('/api/analytics/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.total_vehicles).toBe(10);
    expect(res.body.data.active_vehicles).toBe(7);
    expect(res.body.cached).toBe(false);
  });

  it('GET /api/analytics/vehicle/:id returns vehicle analytics', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1', make: 'Toyota' }] })
      .mockResolvedValueOnce({ rows: [{ total_readings: 100, avg_speed: 55, max_speed: 90, avg_fuel_level: 65 }] })
      .mockResolvedValueOnce({ rows: [{ total_routes: 5, avg_distance: 100, total_distance: 500 }] });

    const res = await request(app).get('/api/analytics/vehicle/v1');
    expect(res.status).toBe(200);
    expect(res.body.data.vehicle.make).toBe('Toyota');
    expect(res.body.data.tracking.total_readings).toBe(100);
  });

  it('GET /api/analytics/vehicle/:id returns 404 for missing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/analytics/vehicle/nonexistent');
    expect(res.status).toBe(404);
  });

  it('GET /api/analytics/fleet/utilization returns utilization', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'v1', make: 'Toyota', status: 'active', total_routes: 3, total_distance: 450, active_routes: 1 }],
    });
    const res = await request(app).get('/api/analytics/fleet/utilization');
    expect(res.status).toBe(200);
    expect(res.body.data.vehicles).toHaveLength(1);
  });
});
