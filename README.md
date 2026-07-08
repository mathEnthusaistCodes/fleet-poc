# FleetPOC — Fleet Management System

A proof-of-concept fleet management system showcasing scalable microservices architecture, real-time GPS tracking, Redis caching, interactive performance load testing, synthetic data generation, and a dark-themed dashboard.

## Architecture

```
┌──────────┐     ┌────────────┐     ┌──────────────┐
│  Client  │────▶│   Gateway  │────▶│  Fleet-svc   │───▶ PostgreSQL
│ (React)  │     │  (Port 4000)│     │  (Port 4001) │
└──────────┘     └────────────┘     └──────────────┘
       │                │                  │
       │                ├──────────────────▶│
       │                │     ┌──────────────┐
       │                │────▶│ Tracking-svc │───▶ PostgreSQL
       │                │     │  (Port 4002) │
       │                │     └──────────────┘
       │                │          │
       │                ├──────────▶│
       │                │     ┌──────────────┐
       │                │────▶│Analytics-svc │───▶ PostgreSQL
       │                │     │  (Port 4003) │        │
       │                │     └──────────────┘        │
       │                │          │                  │
       │                │          └──▶ Redis Cache ──┘
       │                │
       │                │     ┌──────────────────┐
       │                │────▶│ Notification-svc  │───▶ Redis
       │                │     │  (Port 4004, WS)  │
       │                │     └──────────────────┘
```

### Microservices

| Service | Port | Responsibility |
|---------|------|----------------|
| **Gateway** | 4000 | Routes `/api/:service/*` requests to the correct microservice |
| **Fleet-svc** | 4001 | Vehicles, Drivers, Routes CRUD with Zod validation |
| **Tracking-svc** | 4002 | GPS time-series ingestion & query |
| **Analytics-svc** | 4003 | Aggregated KPIs with Redis caching, Load testing engine |
| **Notification-svc** | 4004 | WebSocket real-time alerts via Redis |

### Tech Stack

- **Runtime**: Node.js + TypeScript (all services)
- **Database**: PostgreSQL 16 — tables auto-created on service start with retry logic
- **Cache**: Redis 7 (analytics cache, alert history, cache-hit tracking)
- **Messaging**: RabbitMQ (available for async event-driven extensions)
- **Client**: React 18, Recharts, Leaflet, fully dark-themed
- **Validation**: Zod schemas on all API endpoints
- **Testing**: Jest + Supertest (25+ unit tests across all services)

## Project Structure

```
fleet-poc/
├── services/
│   ├── fleet-svc/          src/  tests/
│   ├── tracking-svc/       src/  tests/
│   ├── analytics-svc/      src/  tests/
│   └── notification-svc/   src/  tests/
├── gateway/                src/  tests/
├── client/                 src/  public/  pages/
├── data-generator/         src/
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop

### Setup

```bash
# 1. Start all services
docker-compose up --build

# 2. Seed synthetic data (in another terminal, after services are ready)
npm start --prefix data-generator
```

Generates 50 vehicles, 30 drivers, 200 routes, and ~100K GPS breadcrumbs.

### Run Tests

```bash
npm test --prefix services/fleet-svc
npm test --prefix services/tracking-svc
npm test --prefix services/analytics-svc
npm test --prefix services/notification-svc
npm test --prefix gateway
```

## Dashboard Pages

Open `http://localhost:3000`:

| Page | Description |
|------|-------------|
| **Overview** | Fleet KPIs, utilization bar chart, vehicle table |
| **Live Map** | Leaflet map with vehicle marker positions (30s auto-refresh) |
| **Analytics** | Status distribution pie chart, top vehicles by distance |
| **Alerts** | Real-time WebSocket notifications from notification-svc |
| **Performance** | Self-service load tester with configurable concurrency & duration |

## Performance Testing

The **Performance** page lets you run load tests directly from the browser:

1. Set **Concurrent Users** (1–500) via slider
2. Set **Duration** (1–30s) via slider
3. Click **Run Load Test**
4. View real-time results including:
   - Total requests, requests/sec
   - Avg / P95 / Min / Max response times
   - Error rate and cache hit rate
   - Historical test trend chart

The analytics-svc internally spawns concurrent requests to fleet-svc and its own cached endpoints, demonstrating the performance benefit of Redis caching.

### Cache Statistics

The Performance page also tracks aggregate cache hit/miss ratios across all analytics endpoints. Cache hits are served in ~1ms vs cache misses hitting the database in ~10–50ms.

## API Endpoints

### Fleet Service
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vehicles` | List all vehicles |
| POST | `/api/vehicles` | Create vehicle |
| GET | `/api/vehicles/:id` | Get vehicle |
| PUT | `/api/vehicles/:id` | Update vehicle |
| DELETE | `/api/vehicles/:id` | Delete vehicle |
| GET | `/api/drivers` | List drivers |
| POST | `/api/drivers` | Create driver |
| GET | `/api/routes` | List routes |
| POST | `/api/routes` | Create route |

### Tracking Service
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tracking/ingest` | Ingest single GPS reading |
| POST | `/api/tracking/ingest/batch` | Batch ingest (up to 1000) |
| GET | `/api/tracking/:vehicleId` | Query readings (from/to/limit/offset) |
| GET | `/api/tracking/:vehicleId/latest` | Latest position |

### Analytics Service
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/summary` | Fleet-wide KPIs (cached) |
| GET | `/api/analytics/vehicle/:id` | Per-vehicle analytics (cached) |
| GET | `/api/analytics/fleet/utilization` | Utilization per vehicle (cached) |
| GET | `/api/analytics/refresh` | Clear analytics cache |
| POST | `/api/analytics/loadtest` | Run load test `{ concurrent, duration }` |
| GET | `/api/analytics/loadtest/cache-stats` | Aggregate cache hit/miss stats |
| POST | `/api/analytics/loadtest/cache-stats/reset` | Reset cache counters |

### Notification Service
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | Last 100 alerts |
| POST | `/api/alerts` | Create and broadcast alert |
| WS | `/ws/alerts` | WebSocket for real-time alerts |

## Key Architecture Decisions

- **PostgreSQL** — relational integrity for vehicles, drivers, routes; indexed timestamps for time-series GPS queries; can be upgraded to TimescaleDB hypertables
- **Redis caching** — analytics endpoints cache for 5 minutes; cache-hit tracking built in; cache invalidated on demand
- **Zod validation** — runtime type safety on all API inputs with human-readable error messages
- **Gateway as router** — `app.use('/api/:service/*')` dynamically proxies to the correct container, preserving the full URL path
- **Services create tables on startup** — `initDb()` runs with retry logic (up to 60s) waiting for PostgreSQL to become available
- **Synthetic data generator** — self-contained script that creates tables if they don't exist, then seeds 50 vehicles, 30 drivers, 200 routes, and ~100K GPS readings
- **Thin controllers** — business logic in service layer, HTTP handling in controllers
- **Per-service Dockerfiles** — each service builds independently for clean horizontal scaling
