import request from 'supertest';
import { app } from '../src/index';

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    lrange: jest.fn().mockResolvedValue([
      JSON.stringify({ id: '1', type: 'fuel', vehicle_id: 'v1', message: 'Low fuel', severity: 'warning', created_at: new Date().toISOString() }),
    ]),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
  }));
});

describe('Notification Service', () => {
  it('GET /health returns status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('notification-svc');
  });

  it('GET /api/alerts returns alerts list', async () => {
    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /api/alerts creates alert', async () => {
    const res = await request(app).post('/api/alerts').send({
      type: 'speed',
      vehicle_id: 'v1',
      message: 'Speeding detected',
      severity: 'critical',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('speed');
  });

  it('POST /api/alerts validates required fields', async () => {
    const res = await request(app).post('/api/alerts').send({ type: 'test' });
    expect(res.status).toBe(400);
  });
});
