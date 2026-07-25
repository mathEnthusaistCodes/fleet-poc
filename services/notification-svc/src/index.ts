import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/alerts' });

const PORT = process.env.PORT || 4004;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

app.use(cors());
app.use(express.json());

interface Alert {
  id: string;
  type: 'geofence' | 'speed' | 'maintenance' | 'fuel' | 'engine';
  vehicle_id: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
}

const clients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  publishMetrics();
});

async function publishMetrics(): Promise<void> {
  try {
    await redis.set('metrics:ws_connections', String(clients.size), 'EX', 10);
  } catch {}
}

setInterval(async () => {
  try {
    const alerts = await redis.lrange('alerts:history', 0, 999);
    const counts = { critical: 0, warning: 0, info: 0 };
    for (const a of alerts) {
      try {
        const parsed = JSON.parse(a);
        if (parsed.severity === 'critical') counts.critical++;
        else if (parsed.severity === 'warning') counts.warning++;
        else counts.info++;
      } catch {}
    }
    await redis.set('metrics:alert_counts', JSON.stringify(counts), 'EX', 10);
    await redis.set('metrics:ws_connections', String(clients.size), 'EX', 10);
  } catch {}
}, 5000);

async function broadcastAlert(alert: Alert): Promise<void> {
  const payload = JSON.stringify({ type: 'alert', data: alert });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-svc', connections: clients.size });
});

app.get('/api/alerts', async (_req, res) => {
  const alerts = await redis.lrange('alerts:history', 0, 99);
  const parsed = alerts.map((a) => JSON.parse(a));
  res.json({ success: true, data: parsed });
});

app.post('/api/alerts', async (req, res) => {
  const { type, vehicle_id, message, severity } = req.body;
  if (!type || !vehicle_id || !message) {
    return res.status(400).json({ success: false, error: { message: 'Missing required fields' } });
  }
  const alert: Alert = {
    id: uuidv4(),
    type,
    vehicle_id,
    message,
    severity: severity || 'info',
    created_at: new Date().toISOString(),
  };

  await redis.lpush('alerts:history', JSON.stringify(alert));
  await redis.ltrim('alerts:history', 0, 999);
  await broadcastAlert(alert);

  res.status(201).json({ success: true, data: alert });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`notification-svc running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log('Shutting down notification-svc...');
    server.close();
    wss.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export { app, server, wss };
