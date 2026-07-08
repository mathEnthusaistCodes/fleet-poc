import { Router, Request, Response } from 'express';
import http from 'http';

export const loadtestRouter = Router();

interface TestResult {
  time: number;
  cached: boolean;
  status: number;
}

function makeRequest(url: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const time = Date.now() - start;
        let cached = false;
        try {
          const json = JSON.parse(body);
          cached = json.cached === true;
        } catch {}
        resolve({ time, cached, status: res.statusCode || 500 });
      });
    }).on('error', () => {
      resolve({ time: Date.now() - start, cached: false, status: 0 });
    });
  });
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let cacheHits = 0;
let cacheMisses = 0;

export function recordCacheAccess(hit: boolean): void {
  if (hit) cacheHits++;
  else cacheMisses++;
}

loadtestRouter.post('/', async (req: Request, res: Response) => {
  const concurrent = Math.min(Math.max(Number(req.body.concurrent) || 10, 1), 500);
  const duration = Math.min(Math.max(Number(req.body.duration) || 5, 1), 30);

  const BASE = process.env.ANALYTICS_SELF_URL || 'http://localhost:4003';
  const FLEET_SVC = process.env.FLEET_SVC_URL || 'http://localhost:4001';

  const targets = [
    `${FLEET_SVC}/api/vehicles`,
    `${BASE}/api/analytics/summary`,
    `${BASE}/api/analytics/fleet/utilization`,
    `${FLEET_SVC}/api/routes`,
  ];

  const results: TestResult[] = [];
  const startTime = Date.now();
  const endTime = startTime + duration * 1000;
  let errors = 0;

  while (Date.now() < endTime) {
    const batch: Promise<TestResult>[] = [];
    for (let i = 0; i < concurrent; i++) {
      batch.push(makeRequest(pick(targets)));
    }
    const batchResults = await Promise.allSettled(batch);
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        if (r.value.status === 0 || r.value.status >= 500) errors++;
      } else {
        errors++;
      }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const times = results.map(r => r.time);
  const cachedCount = results.filter(r => r.cached).length;
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;

  res.json({
    success: true,
    data: {
      config: { concurrent, duration_seconds: duration },
      total_requests: results.length,
      errors,
      error_rate: results.length > 0 ? Math.round((errors / results.length) * 100) : 0,
      cache_hits: cachedCount,
      cache_hit_rate: results.length > 0 ? Math.round((cachedCount / results.length) * 100) : 0,
      avg_response_time_ms: Math.round(avg),
      min_response_time_ms: sorted.length > 0 ? Math.round(sorted[0]) : 0,
      max_response_time_ms: sorted.length > 0 ? Math.round(sorted[sorted.length - 1]) : 0,
      p95_response_time_ms: sorted.length > 0 ? Math.round(sorted[Math.floor(sorted.length * 0.95)]) : 0,
      requests_per_second: Math.round(results.length / elapsed),
      test_duration_seconds: Math.round(elapsed * 10) / 10,
    },
  });
});

loadtestRouter.get('/cache-stats', (_req: Request, res: Response) => {
  const total = cacheHits + cacheMisses;
  res.json({
    success: true,
    data: {
      hits: cacheHits,
      misses: cacheMisses,
      total,
      hit_rate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
    },
  });
});

loadtestRouter.post('/cache-stats/reset', (_req: Request, res: Response) => {
  cacheHits = 0;
  cacheMisses = 0;
  res.json({ success: true, data: { message: 'Cache stats reset' } });
});
