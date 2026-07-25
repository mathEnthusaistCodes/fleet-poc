import Redis from 'ioredis';
import { getPool } from './db';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, enableOfflineQueue: false });

interface RequestRecord {
  timestamp: number;
  durationMs: number;
}

const requestLog: RequestRecord[] = [];
const MAX_LOG_AGE_MS = 60_000;
const MAX_LOG_SIZE = 5000;

let gpsIngestCount = 0;
let lastGpsCountReset = Date.now();
const GPS_RATE_WINDOW_MS = 60_000;

let cachedVehicleStats: any = null;
let vehicleStatsCacheTime = 0;
const VEHICLE_STATS_TTL_MS = 5_000;

let cachedAlertCounts: any = null;
let alertCountsCacheTime = 0;
const ALERT_COUNTS_TTL_MS = 3_000;

let cachedWsConnections = 0;
let wsConnectionsCacheTime = 0;
const WS_TTL_MS = 3_000;

export function recordRequest(durationMs: number): void {
  const now = Date.now();
  requestLog.push({ timestamp: now, durationMs });
  pruneOldEntries(now);
}

export function recordGpsIngest(count: number = 1): void {
  gpsIngestCount += count;
}

function pruneOldEntries(now: number): void {
  const cutoff = now - MAX_LOG_AGE_MS;
  while (requestLog.length > 0 && requestLog[0].timestamp < cutoff) {
    requestLog.shift();
  }
  if (requestLog.length > MAX_LOG_SIZE) {
    requestLog.splice(0, requestLog.length - MAX_LOG_SIZE);
  }
}

function computeRps(windowMs: number): number {
  const now = Date.now();
  const cutoff = now - windowMs;
  let count = 0;
  for (let i = requestLog.length - 1; i >= 0; i--) {
    if (requestLog[i].timestamp < cutoff) break;
    count++;
  }
  return Math.round((count / windowMs) * 1000);
}

function computeLatencyPercentiles(): { avg: number; p50: number; p95: number; p99: number } {
  if (requestLog.length === 0) {
    return { avg: 0, p50: 0, p95: 0, p99: 0 };
  }
  const sorted = requestLog.map(r => r.durationMs).sort((a, b) => a - b);
  const len = sorted.length;
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / len);
  const p50 = sorted[Math.floor(len * 0.5)];
  const p95 = sorted[Math.floor(len * 0.95)];
  const p99 = sorted[Math.floor(len * 0.99)];
  return { avg, p50, p95, p99 };
}

function computeGpsRate(): number {
  const now = Date.now();
  const elapsed = (now - lastGpsCountReset) / 1000;
  if (elapsed >= 1) {
    const rate = Math.round((gpsIngestCount / elapsed) * 60);
    gpsIngestCount = 0;
    lastGpsCountReset = now;
    return rate;
  }
  return Math.round((gpsIngestCount / Math.max(elapsed, 0.1)) * 60);
}

async function getVehicleStats(): Promise<any> {
  const now = Date.now();
  if (cachedVehicleStats && (now - vehicleStatsCacheTime) < VEHICLE_STATS_TTL_MS) {
    return cachedVehicleStats;
  }

  try {
    const [totalRes, activeRes, idleRes, maintRes, routesRes] = await Promise.all([
      getPool().query('SELECT COUNT(*)::int as count FROM vehicles'),
      getPool().query("SELECT COUNT(*)::int as count FROM vehicles WHERE status = 'active'"),
      getPool().query("SELECT COUNT(*)::int as count FROM vehicles WHERE status = 'idle'"),
      getPool().query("SELECT COUNT(*)::int as count FROM vehicles WHERE status = 'maintenance'"),
      getPool().query("SELECT COUNT(*)::int as count FROM routes WHERE status = 'in_progress'"),
    ]);

    let gpsLastMinute = 0;
    try {
      const gpsCount = await redis.get('metrics:gps_count');
      gpsLastMinute = gpsCount ? parseInt(gpsCount) : 0;
    } catch {}

    cachedVehicleStats = {
      total: totalRes.rows[0].count,
      active: activeRes.rows[0].count,
      idle: idleRes.rows[0].count,
      maintenance: maintRes.rows[0].count,
      activeRoutes: routesRes.rows[0].count,
      gpsLastMinute,
    };
    vehicleStatsCacheTime = now;
  } catch (err) {
    if (cachedVehicleStats) return cachedVehicleStats;
    cachedVehicleStats = { total: 0, active: 0, idle: 0, maintenance: 0, activeRoutes: 0, gpsLastMinute: 0 };
  }

  return cachedVehicleStats;
}

async function getAlertCounts(): Promise<any> {
  const now = Date.now();
  if (cachedAlertCounts && (now - alertCountsCacheTime) < ALERT_COUNTS_TTL_MS) {
    return cachedAlertCounts;
  }

  try {
    const alerts = await redis.lrange('alerts:history', 0, 999);
    const counts = { total: alerts.length, critical: 0, warning: 0, info: 0 };
    for (const a of alerts) {
      try {
        const parsed = JSON.parse(a);
        if (parsed.severity === 'critical') counts.critical++;
        else if (parsed.severity === 'warning') counts.warning++;
        else counts.info++;
      } catch {}
    }
    cachedAlertCounts = counts;
    alertCountsCacheTime = now;
  } catch {
    if (cachedAlertCounts) return cachedAlertCounts;
    cachedAlertCounts = { total: 0, critical: 0, warning: 0, info: 0 };
  }

  return cachedAlertCounts;
}

async function getWsConnections(): Promise<number> {
  const now = Date.now();
  if ((now - wsConnectionsCacheTime) < WS_TTL_MS) {
    return cachedWsConnections;
  }

  try {
    const val = await redis.get('metrics:ws_connections');
    cachedWsConnections = val ? parseInt(val) : 0;
    wsConnectionsCacheTime = now;
  } catch {
    cachedWsConnections = 0;
  }

  return cachedWsConnections;
}

export async function getMetricsSnapshot(): Promise<any> {
  const [vehicleStats, alertCounts, wsConnections] = await Promise.all([
    getVehicleStats(),
    getAlertCounts(),
    getWsConnections(),
  ]);

  return {
    rps: {
      '1s': computeRps(1000),
      '5s': computeRps(5000),
      '30s': computeRps(30_000),
    },
    latency: computeLatencyPercentiles(),
    gps: {
      ratePerMin: computeGpsRate(),
      lastMinute: vehicleStats.gpsLastMinute,
    },
    fleet: {
      total: vehicleStats.total,
      active: vehicleStats.active,
      idle: vehicleStats.idle,
      maintenance: vehicleStats.maintenance,
      activeRoutes: vehicleStats.activeRoutes,
    },
    alerts: alertCounts,
    wsConnections,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export function startMetricsWriter(): void {
  setInterval(async () => {
    try {
      const snapshot = await getMetricsSnapshot();
      await redis.set('metrics:latest', JSON.stringify(snapshot), 'EX', 10);
    } catch {}
  }, 5000);
}
