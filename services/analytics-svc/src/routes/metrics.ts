import { Router, Request, Response } from 'express';
import { getMetricsSnapshot } from '../metrics';

export const metricsRouter = Router();

metricsRouter.get('/snapshot', async (_req: Request, res: Response) => {
  try {
    const snapshot = await getMetricsSnapshot();
    res.json({ success: true, data: snapshot });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

metricsRouter.get('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  res.write(':connected\n\n');

  let alive = true;
  let metricsInterval: NodeJS.Timeout;
  let keepaliveInterval: NodeJS.Timeout;

  const sendMetrics = async () => {
    if (!alive) return;
    try {
      const snapshot = await getMetricsSnapshot();
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch {
      res.write(`data: ${JSON.stringify({ error: 'metrics unavailable', timestamp: new Date().toISOString() })}\n\n`);
    }
  };

  metricsInterval = setInterval(sendMetrics, 1000);

  keepaliveInterval = setInterval(() => {
    if (alive) {
      res.write(':keepalive\n\n');
    }
  }, 15_000);

  sendMetrics();

  req.on('close', () => {
    alive = false;
    clearInterval(metricsInterval);
    clearInterval(keepaliveInterval);
  });
});
