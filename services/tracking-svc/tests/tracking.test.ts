import request from 'supertest';
import app from '../src/index';

jest.mock('../src/db', () => {
  const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() }),
  };
  return { initDb: jest.fn(), getPool: () => mockPool };
});

import { getPool } from '../src/db';
const mockQuery = getPool().query as jest.Mock;

describe('Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/tracking/ingest creates a reading', async () => {
    const reading = {
      vehicle_id: '00000000-0000-0000-0000-000000000001',
      lat: 40.7128, lng: -74.0060,
      speed: 65, heading: 180, fuel_level: 75.5,
    };
    mockQuery.mockResolvedValue({ rows: [{ id: 'reading-1', ...reading }] });
    const res = await request(app).post('/api/tracking/ingest').send(reading);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/tracking/ingest validates lat/lng', async () => {
    const res = await request(app).post('/api/tracking/ingest').send({
      vehicle_id: 'abc', lat: 200, lng: 0,
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/tracking/ingest/batch ingests multiple', async () => {
    const batch = {
      readings: [
        { vehicle_id: '00000000-0000-0000-0000-000000000001', lat: 40.71, lng: -74.00 },
        { vehicle_id: '00000000-0000-0000-0000-000000000001', lat: 40.72, lng: -74.01 },
      ],
    };
    const mockClient = { query: jest.fn(), release: jest.fn() };
    (getPool().connect as jest.Mock).mockResolvedValue(mockClient);
    const res = await request(app).post('/api/tracking/ingest/batch').send(batch);
    expect(res.status).toBe(201);
  });

  it('GET /api/tracking/:vehicleId returns readings', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'r1' }, { id: 'r2' }] });
    const res = await request(app).get('/api/tracking/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('GET /api/tracking/:vehicleId/latest returns latest', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'r1', speed: 60 }] });
    const res = await request(app).get('/api/tracking/abc/latest');
    expect(res.status).toBe(200);
    expect(res.body.data.speed).toBe(60);
  });

  it('GET /api/tracking/:vehicleId/latest returns 404 if none', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).get('/api/tracking/abc/latest');
    expect(res.status).toBe(404);
  });
});
