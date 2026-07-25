# FleetPOC — Technical Architecture

## System Overview

FleetPOC is a **microservices-based fleet management platform** built with Node.js, TypeScript, PostgreSQL, Redis, and React. It demonstrates production-grade patterns: API gateway with rate limiting and circuit breakers, event-driven alerting, real-time metrics streaming, and multi-layer caching.

```
┌──────────────┐
│  React SPA   │ :3000
│  Dashboard   │
└──────┬───────┘
       │ HTTP / WebSocket / SSE
       ▼
┌──────────────┐
│   Gateway    │ :4000
│ Rate Limiter │
│Circuit Breaker│
└──┬───┬───┬───┘
   │   │   │
   ▼   ▼   ▼
┌────┐┌────┐┌────────┐┌────────────┐
│Fleet││Trk ││Analytics││Notification│
│:4001││:4002││:4003   ││:4004 (WS) │
└──┬──┘└──┬─┘└───┬────┘└─────┬─────┘
   │      │      │            │
   ▼      ▼      ▼            ▼
┌──────────────────────────────────────┐
│          PostgreSQL 16               │
│  vehicles │ drivers │ routes │       │
│               gps_readings           │
└──────────────────────────────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
┌───────────┐  ┌───────────┐
│  Redis 7  │  │ RabbitMQ  │
│  Cache +  │  │  (Ready   │
│  Metrics  │  │  for async│
└───────────┘  │  events)  │
               └───────────┘
```

## Microservices

### Gateway (`gateway/` — Port 4000)

The single entry point for all client traffic. Implements three critical infrastructure patterns:

**Routing** — Dynamically proxies requests to the correct backend:
```
/api/vehicles/*      → fleet-svc:4001
/api/tracking/*      → tracking-svc:4002
/api/analytics/*     → analytics-svc:4003
/api/alerts/*        → notification-svc:4004
```

**Rate Limiting** — Per-IP sliding window (default: 200 requests/minute):
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 187
X-RateLimit-Reset: 1721430000
```
Returns `429 Too Many Requests` when exceeded. Prevents any single client from overwhelming the system.

**Circuit Breaker** — Per-service fault tolerance:
```
States: CLOSED → OPEN → HALF_OPEN → CLOSED
- CLOSED: Normal operation. Failures counted.
- OPEN: After 5 consecutive failures. Returns 503 immediately.
- HALF_OPEN: After 30s cooldown. One probe request allowed.
- CLOSED: If probe succeeds, normal operation resumes.
```
Prevents cascade failures when a downstream service is unhealthy.

### Fleet Service (`services/fleet-svc/` — Port 4001)

The core entity service. Manages vehicles, drivers, and routes with full CRUD operations.

**Data Model:**
- `vehicles` — 50 fields: make, model, year, license_plate, VIN, fuel_type, status
- `drivers` — Name, email, phone, license_number, assigned_vehicle_id
- `routes` — Origin/destination coordinates, distance, status (planned → in_progress → completed)

**Key Design Decisions:**
- **Zod validation** on every endpoint — rejects malformed input at the border
- **UUID primary keys** — No sequential ID leakage
- **Referential integrity** — Foreign keys between vehicles ↔ drivers ↔ routes
- **Soft state machine** — Routes transition through `planned → in_progress → completed`

### Tracking Service (`services/tracking-svc/` — Port 4002)

High-throughput GPS time-series ingestion. Designed for write-heavy workloads.

**Write Path:**
```
POST /api/tracking/ingest
  → Validate lat/lng/speed/heading
  → INSERT INTO gps_readings
  → Redis INCR metrics:gps_count (TTL 120s)
  → 201 Created
```

**Batch Ingest:**
```
POST /api/tracking/ingest/batch
  → Validate array of 1-1000 readings
  → BEGIN TRANSACTION
  → INSERT all readings
  → COMMIT
  → Redis INCRBY metrics:gps_count N
  → 201 Created
```

**Read Path:**
```
GET /api/tracking/:vehicleId?from=&to=&limit=1000
  → SELECT * FROM gps_readings
    WHERE vehicle_id = ? AND recorded_at BETWEEN ? AND ?
    ORDER BY recorded_at DESC LIMIT ?
  → 200 OK
```

**Index:** Composite index on `(vehicle_id, recorded_at DESC)` for fast time-range queries.

### Analytics Service (`services/analytics-svc/` — Port 4003)

The intelligence layer. Computes fleet KPIs, manages caching, and runs load tests.

**Caching Architecture:**
```
Request → Check Redis Cache
           ├── HIT  → Return cached response (~1ms)
           └── MISS → Query PostgreSQL (~10-50ms)
                       → Store in Redis (TTL: 300s)
                       → Return response
```

Cache keys follow the pattern `analytics:{scope}:{id}`. Invalidated on-demand via `GET /api/analytics/refresh`.

**Metrics Engine (in-memory):**
- Rolling request log (max 5000 entries, max 60s age)
- Computes RPS across 1s / 5s / 30s windows
- Calculates latency percentiles: p50, p95, p99
- Writes full snapshot to Redis every 5s for cross-service access

**SSE Stream:**
```
GET /api/analytics/metrics/stream
  → Content-Type: text/event-stream
  → Sends full metrics JSON every 1 second
  → Keepalive comments every 15s
```

### Notification Service (`services/notification-svc/` — Port 4004)

Real-time alert system using WebSocket + Redis.

**Alert Pipeline:**
```
POST /api/alerts
  → Validate type/severity/vehicle_id
  → Generate UUID + timestamp
  → Redis LPUSH alerts:history (trim to 1000)
  → WebSocket broadcast to all connected clients
  → 201 Created
```

**WebSocket Protocol:**
```json
// Client connects to ws://localhost:4004/ws/alerts
// Server pushes:
{
  "type": "alert",
  "data": {
    "id": "uuid",
    "type": "geofence",
    "vehicle_id": "uuid",
    "message": "Vehicle left geofence",
    "severity": "critical",
    "created_at": "2026-07-22T10:00:00Z"
  }
}
```

**Metrics Writer:** Updates Redis every 5s:
- `metrics:alert_counts` — JSON with critical/warning/info counts
- `metrics:ws_connections` — Active WebSocket connection count

## Database Schema

```sql
-- Core entity tables
CREATE TABLE vehicles (
    id UUID PRIMARY KEY,
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vin VARCHAR(17) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    fuel_type VARCHAR(20) NOT NULL,
    fuel_capacity DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE drivers (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    assigned_vehicle_id UUID REFERENCES vehicles(id)
);

CREATE TABLE routes (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    vehicle_id UUID REFERENCES vehicles(id),
    driver_id UUID REFERENCES drivers(id),
    origin_lat DECIMAL(10,7) NOT NULL,
    origin_lng DECIMAL(10,7) NOT NULL,
    dest_lat DECIMAL(10,7) NOT NULL,
    dest_lng DECIMAL(10,7) NOT NULL,
    distance_km DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'planned'
);

-- Time-series table
CREATE TABLE gps_readings (
    id UUID PRIMARY KEY,
    vehicle_id UUID NOT NULL,
    lat DECIMAL(10,7) NOT NULL,
    lng DECIMAL(10,7) NOT NULL,
    speed DECIMAL(10,2),
    heading DECIMAL(5,2),
    fuel_level DECIMAL(5,2),
    engine_temp DECIMAL(5,2),
    odometer DECIMAL(10,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gps_vehicle_time
    ON gps_readings(vehicle_id, recorded_at DESC);
```

**Schema Strategy:** Each service owns its tables and runs `initDb()` on startup with retry logic (up to 30 attempts, 2s apart). This eliminates migration coordination between services.

## Redis Usage

| Key Pattern | Type | TTL | Purpose |
|------------|------|-----|---------|
| `analytics:summary` | String (JSON) | 300s | Cached fleet summary |
| `analytics:vehicle:{id}` | String (JSON) | 300s | Cached per-vehicle analytics |
| `analytics:utilization` | String (JSON) | 300s | Cached utilization data |
| `metrics:gps_count` | Integer | 120s | GPS readings counter |
| `metrics:latest` | String (JSON) | 10s | Full metrics snapshot |
| `metrics:alert_counts` | String (JSON) | 10s | Alert counts by severity |
| `metrics:ws_connections` | Integer | 10s | Active WS connection count |
| `alerts:history` | List | — | Last 1000 alert objects |

## Data Flow: GPS Ingestion to Dashboard

```
1. Data Generator (or real GPS device)
   POST /api/tracking/ingest/batch
   Body: { readings: [{ vehicle_id, lat, lng, speed, ... }] }

2. Gateway (rate limit check → circuit breaker check)
   Proxy to tracking-svc:4002

3. Tracking-svc
   → Validate each reading with Zod
   → BEGIN TRANSACTION
   → INSERT INTO gps_readings (batch)
   → COMMIT
   → Redis INCR metrics:gps_count

4. Analytics-svc (every 1s via SSE)
   → Reads metrics:gps_count from Redis
   → Reads fleet stats from PostgreSQL
   → Computes RPS, latency percentiles
   → Pushes to all connected SSE clients

5. React Client (useMetricsStream hook)
   → Receives SSE event
   → Updates AnimatedNumber components (smooth counting animation)
   → Updates Sparkline charts (RPS history)
   → Updates FleetHealthScore gauge
```

## Real-Time Features

### Server-Sent Events (SSE)
- **Endpoint:** `GET /api/analytics/metrics/stream`
- **Update frequency:** Every 1 second
- **Data:** RPS, latency percentiles, fleet stats, alert counts, GPS rate
- **Fallback:** Client auto-switches to polling `/api/analytics/metrics/snapshot` every 2s if SSE fails

### WebSocket
- **Endpoint:** `ws://localhost:4004/ws/alerts`
- **Use case:** Push alerts to all connected browsers in real-time
- **Reconnection:** Client handles disconnects gracefully

### Live Data Generator
```
npm run generate-data-live
```
- Seeds 50 vehicles, 30 drivers, 200 routes
- Sends 10-30 GPS readings every 2 seconds through tracking-svc API
- Generates random alerts (geofence, speed, maintenance, fuel, engine)
- Runs indefinitely until Ctrl+C

## Project Structure

```
fleet-poc/
├── gateway/                  # API gateway with rate limiting + circuit breaker
│   ├── src/index.ts
│   └── tests/gateway.test.ts
├── services/
│   ├── fleet-svc/            # Vehicle, driver, route CRUD
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── db.ts         # PostgreSQL connection + initDb()
│   │   │   ├── validators.ts # Zod schemas
│   │   │   └── routes/
│   │   │       ├── vehicles.ts
│   │   │       ├── drivers.ts
│   │   │       └── routes.ts
│   │   └── tests/fleet.test.ts
│   ├── tracking-svc/         # GPS ingestion + queries
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── db.ts
│   │   │   ├── validators.ts
│   │   │   └── routes/tracking.ts
│   │   └── tests/tracking.test.ts
│   ├── analytics-svc/        # KPIs, caching, metrics, load testing
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── db.ts
│   │   │   ├── cache.ts      # Redis cache layer
│   │   │   ├── metrics.ts    # In-memory metrics engine
│   │   │   └── routes/
│   │   │       ├── analytics.ts
│   │   │       ├── metrics.ts   # SSE stream
│   │   │       └── loadtest.ts  # Load test runner
│   │   └── tests/analytics.test.ts
│   └── notification-svc/     # WebSocket alerts + Redis
│       ├── src/index.ts
│       └── tests/notification.test.ts
├── client/                   # React SPA
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Overview.jsx      # Dashboard with live metrics
│   │   │   ├── LiveMap.jsx       # Leaflet vehicle map
│   │   │   ├── Analytics.jsx     # Charts and stats
│   │   │   ├── Alerts.jsx        # Real-time alert feed
│   │   │   └── Performance.jsx   # Load test UI + SLA dashboard
│   │   ├── components/
│   │   │   ├── AnimatedNumber.jsx
│   │   │   ├── Sparkline.jsx
│   │   │   ├── FleetHealthScore.jsx
│   │   │   ├── ActivityFeed.jsx
│   │   │   ├── SystemHealthStrip.jsx
│   │   │   ├── ThroughputGauge.jsx
│   │   │   └── Badge.jsx
│   │   ├── hooks/useMetricsStream.js
│   │   └── services/api.js
│   └── Dockerfile
├── data-generator/           # Synthetic data + live stream
│   └── src/generate.ts
├── docker-compose.yml        # 9 containers
└── package.json
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20 + TypeScript 5.3 | Shared language across all services |
| Framework | Express 4.18 | Minimal, well-understood, fast |
| Database | PostgreSQL 16 | ACID, JSON support, mature ecosystem |
| Cache | Redis 7 | Sub-ms reads, TTL-based expiry, pub/sub |
| Messaging | RabbitMQ 3 | Ready for async event-driven extensions |
| Client | React 18 + Recharts + Leaflet | Component-based, rich charting, mapping |
| Validation | Zod 3.22 | Runtime type safety with TypeScript inference |
| Testing | Jest 29 + Supertest | Unit tests with HTTP assertions |
| Containers | Docker + Docker Compose | Reproducible dev environment, one command startup |

## Design Principles

1. **Service autonomy** — Each service owns its database tables and runs `initDb()` independently. No shared migrations.
2. **Fail fast** — Zod validation at the API border. Circuit breakers prevent cascade failures.
3. **Observability first** — Every service writes health metrics. SSE streams expose real-time system state.
4. **Cache strategically** — Analytics endpoints cache for 5 minutes. GPS counters use 120s TTL. Metrics use 10s TTL.
5. **Thin controllers** — Business logic in service modules, HTTP handling in route files.
