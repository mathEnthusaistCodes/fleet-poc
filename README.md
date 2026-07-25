# FleetPOC — Fleet Management Infrastructure

A proof-of-concept demonstrating the **infrastructure layer** for a real-time fleet management platform: microservices architecture, GPS ingestion, Redis caching, SSE metrics streaming, circuit breakers, rate limiting, and built-in load testing.

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| **[Business Case](README-business.md)** | Non-technical stakeholders | Problem statement, what's built, future enhancements roadmap |
| **[Technical Architecture](README-architecture.md)** | Engineers, architects | Microservices design, database schema, data flows, tech stack |
| **[Performance Testing](README-performance.md)** | QA, DevOps, engineers | Load test guide, SLA metrics, cache analysis, multi-region testing |

## Quick Start

```bash
# Start all services
docker-compose up --build

# Seed demo data + start live GPS stream
npm run generate-data-live
```

Open **http://localhost:3000**

## What's Inside

- **5 microservices**: Gateway, Fleet-svc, Tracking-svc, Analytics-svc, Notification-svc
- **Real-time dashboard**: Live metrics via SSE, animated KPIs, sparklines, fleet health score
- **Interactive map**: Leaflet map with live vehicle positions
- **Built-in load testing**: Run from the browser, no external tools needed
- **Synthetic data generator**: 50 vehicles, 30 drivers, 200 routes, continuous GPS stream
- **Redis caching**: Analytics served from cache in ~1ms vs ~50ms from database
- **Circuit breakers + rate limiting**: Production-grade resilience patterns
- **26 unit tests**: Jest + Supertest across all services

## Architecture at a Glance

```
React SPA (:3000) → Gateway (:4000) → Fleet-svc (:4001)    → PostgreSQL
                                  → Tracking-svc (:4002)   → PostgreSQL + Redis
                                  → Analytics-svc (:4003)  → PostgreSQL + Redis
                                  → Notification-svc (:4004) → Redis + WebSocket
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript 5.3 |
| Framework | Express 4.18 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Messaging | RabbitMQ 3 (ready for async events) |
| Client | React 18, Recharts, Leaflet |
| Validation | Zod 3.22 |
| Testing | Jest 29 + Supertest |
| Containers | Docker + Docker Compose (Alpine) |

## License

Internal proof-of-concept. Not licensed for distribution.
