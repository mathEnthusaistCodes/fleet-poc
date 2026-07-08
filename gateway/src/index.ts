import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

const SERVICES: Record<string, string> = {
  'vehicles': process.env.FLEET_SVC_URL || 'http://localhost:4001',
  'drivers': process.env.FLEET_SVC_URL || 'http://localhost:4001',
  'routes': process.env.FLEET_SVC_URL || 'http://localhost:4001',
  'tracking': process.env.TRACKING_SVC_URL || 'http://localhost:4002',
  'analytics': process.env.ANALYTICS_SVC_URL || 'http://localhost:4003',
  'alerts': process.env.NOTIFICATION_SVC_URL || 'http://localhost:4004',
};

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100');
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
  halfOpen: boolean;
}
const circuits = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = parseInt(process.env.CIRCUIT_THRESHOLD || '5');
const CIRCUIT_TIMEOUT = parseInt(process.env.CIRCUIT_TIMEOUT_MS || '30000');
const REGION_LATENCY = parseInt(process.env.SIMULATED_REGION_LATENCY_MS || '0');

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

app.get('/api/services', (_req, res) => {
  res.json({ success: true, data: SERVICES });
});

app.get('/api/gateway/status', (_req, res) => {
  const circuitStatus: Record<string, any> = {};
  for (const [svc, state] of circuits) {
    circuitStatus[svc] = { open: state.open, failures: state.failures, halfOpen: state.halfOpen };
  }
  res.json({
    success: true,
    data: {
      rateLimitMax: RATE_LIMIT_MAX,
      rateLimitWindowMs: RATE_LIMIT_WINDOW,
      simulatedRegionLatencyMs: REGION_LATENCY,
      circuits: circuitStatus,
      services: SERVICES,
    },
  });
});

function rateLimiter(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, RATE_LIMIT_MAX - entry.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: { message: 'Rate limit exceeded', retryAfter: Math.ceil((entry.resetAt - now) / 1000) } });
  }
  next();
}

function checkCircuit(service: string): boolean {
  const state = circuits.get(service) || { failures: 0, lastFailure: 0, open: false, halfOpen: false };
  if (state.open) {
    if (Date.now() - state.lastFailure > CIRCUIT_TIMEOUT) {
      state.halfOpen = true;
      circuits.set(service, state);
      return true;
    }
    return false;
  }
  return true;
}

function recordFailure(service: string) {
  const state = circuits.get(service) || { failures: 0, lastFailure: 0, open: false, halfOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    console.log(`[circuit] ${service} circuit OPEN`);
  }
  circuits.set(service, state);
}

function recordSuccess(service: string) {
  const state = circuits.get(service);
  if (state) {
    if (state.halfOpen) {
      console.log(`[circuit] ${service} circuit CLOSED`);
    }
    circuits.set(service, { failures: 0, lastFailure: 0, open: false, halfOpen: false });
  }
}

app.use('/api/:service/*', rateLimiter, (req, res) => {
  const { service } = req.params;
  const target = SERVICES[service];
  if (!target) {
    return res.status(404).json({ success: false, error: { message: `Unknown service: ${service}` } });
  }

  if (!checkCircuit(service)) {
    return res.status(503).json({ success: false, error: { message: `Circuit breaker: ${service} is unavailable` } });
  }

  const targetUrl = new URL(target);
  const proxyPath = req.originalUrl;
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: proxyPath,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    recordSuccess(service);
    if (REGION_LATENCY > 0) {
      // Simulate cross-region latency
      const start = Date.now();
      const remaining = REGION_LATENCY - (Date.now() - start);
      if (remaining > 0) {
        setTimeout(() => {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        }, remaining);
        return;
      }
    }
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    recordFailure(service);
    console.error(`[gateway] Proxy error for ${proxyPath}:`, err.message);
    res.status(502).json({ success: false, error: { message: `Cannot reach ${service}` } });
  });

  req.pipe(proxyReq);
});

app.use('/api/:service', rateLimiter, (req, res) => {
  const { service } = req.params;
  const target = SERVICES[service];
  if (!target) {
    return res.status(404).json({ success: false, error: { message: `Unknown service: ${service}` } });
  }

  if (!checkCircuit(service)) {
    return res.status(503).json({ success: false, error: { message: `Circuit breaker: ${service} is unavailable` } });
  }

  const targetUrl = new URL(target);
  const proxyPath = req.originalUrl;
  const options = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || 80,
    path: proxyPath,
    method: req.method,
    headers: { ...req.headers, host: targetUrl.host },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    recordSuccess(service);
    if (REGION_LATENCY > 0) {
      setTimeout(() => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }, REGION_LATENCY);
      return;
    }
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    recordFailure(service);
    console.error(`[gateway] Proxy error for ${proxyPath}:`, err.message);
    res.status(502).json({ success: false, error: { message: `Cannot reach ${service}` } });
  });

  req.pipe(proxyReq);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`gateway running on port ${PORT}`);
  });
}

export default app;
