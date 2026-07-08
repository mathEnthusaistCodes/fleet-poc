import request from 'supertest';
import app from '../src/index';

describe('Gateway', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('gateway');
  });

  it('GET /api/services returns service map', async () => {
    const res = await request(app).get('/api/services');
    expect(res.status).toBe(200);
    expect(res.body.data['vehicles']).toBeDefined();
  });

  it('GET /api/unknown returns 404', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });

  it('GET /api/vehicles returns 502 when target unreachable', async () => {
    const res = await request(app).get('/api/vehicles');
    expect(res.status).toBe(502);
  });
});
