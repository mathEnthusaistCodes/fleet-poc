# FleetPOC — Business Case

## The Problem

Fleet operators managing 50+ vehicles face a daily battle against **invisible costs**:

- **Fuel waste**: Drivers taking inefficient routes, idling too long, or driving aggressively burns 15-20% more fuel than necessary.
- **Reactive maintenance**: Vehicles break down on the road because oil changes, brake inspections, and tire rotations were missed. A single roadside breakdown costs $1,500-3,000 in towing + lost delivery revenue.
- **Driver accountability**: Without real-time visibility, there's no way to know if a driver is on-route, speeding, or parked somewhere they shouldn't be.
- **Dispatch inefficiency**: Managers manually phone drivers to check status. Route reassignment takes 20-30 minutes instead of seconds.

### What Existing Solutions Get Wrong

| Vendor Approach | Why It Fails |
|-----------------|--------------|
| Hardware-only (Geotab, Samsara) | Requires $200-400/vehicle device + installation. 6-month contract lock-in. Data is siloed. |
| Legacy software (Fleet Complete) | Desktop-only UI. No real-time alerts. 90s-era database architecture. |
| Spreadsheet tracking | No GPS integration. Manual entry errors. Can't scale past 20 vehicles. |
| Generic IoT platforms | Overkill for fleet. Requires custom development. $10K+/month. |

## What FleetPOC Actually Demonstrates

FleetPOC is a **proof-of-concept fleet management platform** that demonstrates the core infrastructure needed for real-time vehicle tracking and fleet analytics. It is not a complete product — it is a working foundation that proves the architecture can handle production-scale traffic.

### Core Capabilities (Built and Working)

#### 1. Real-Time Fleet Visibility
- **Live map** showing every vehicle's GPS position, speed, and fuel level on an interactive Leaflet map
- **Dashboard** with fleet health score, active/idle/maintenance vehicle counts, GPS ingestion rate, and alert counts
- **System health monitoring** showing the status and latency of every microservice

#### 2. Event-Driven Alerting
- **Real-time alerts** via WebSocket for geofence breaches, speeding, low fuel, engine faults, and maintenance reminders
- **Severity classification** (critical / warning / info) so dispatchers prioritize what matters
- **Alert history** stored in Redis with up to 1000 entries, queryable via API

#### 3. Fleet Analytics
- **Vehicle utilization data**: routes completed, total distance, active route count per vehicle
- **Fleet-wide KPIs**: total vehicles, active vehicles, average fuel capacity, average route distance
- **Aggregated metrics**: GPS readings ingested, alert counts by severity
- **Redis caching**: Analytics queries served from cache in ~1ms vs ~50ms from database

#### 4. GPS Time-Series Ingestion
- **High-throughput ingestion**: Supports batch uploads of up to 1000 GPS readings per request
- **Time-range queries**: Query any vehicle's GPS history with from/to/limit/offset parameters
- **Indexed for performance**: Composite index on `(vehicle_id, recorded_at DESC)` for fast lookups

#### 5. Production-Grade Infrastructure
- **API Gateway** with per-IP rate limiting and per-service circuit breakers
- **Microservices architecture**: 5 independent services, each deployable and scalable separately
- **SSE metrics streaming**: Real-time RPS, latency percentiles, and fleet stats pushed to the dashboard every second
- **Built-in load testing**: Run from the browser with configurable concurrency (1-500 users), duration, and simulated cross-region latency

### What the Data Shows

The system processes data from **50 vehicles, 30 drivers, and 200 routes** with continuous GPS streams. The dashboard displays:

| Metric | Source | What It Shows |
|--------|--------|---------------|
| Fleet Health Score | Computed from vehicle status + alerts | Overall fleet operational health (0-100) |
| Active / Idle / Maintenance | PostgreSQL vehicle status | How many vehicles are in each state |
| GPS Readings/min | Redis counter | Real-time data throughput |
| Alert Counts | Redis alert history | Critical / warning / info breakdown |
| Top Vehicle Utilization | PostgreSQL route + distance | Which vehicles have the most routes and distance |
| RPS / Latency | In-memory rolling window | System performance under load |

### Competitive Differentiators

1. **No hardware required** — Works with any GPS data source (devices, smartphones, OBD-II dongles)
2. **Real-time everything** — Sub-second alert delivery via WebSocket, live metrics via SSE
3. **Self-service analytics** — Managers run their own reports through the dashboard without IT
4. **Built-in performance testing** — Proves the system handles scale before you commit to production
5. **Open architecture** — REST APIs integrate with existing TMS, ERP, and accounting systems

## Target Customers

| Segment | Use Case | Fleet Size |
|---------|----------|-----------|
| **Last-mile delivery** | Real-time driver tracking, route compliance | 50-200 vehicles |
| **Construction** | Equipment tracking, job site geofencing | 20-100 vehicles |
| **Municipal fleets** | Waste management, public works | 30-150 vehicles |
| **Trucking companies** | Driver safety monitoring, fuel tracking | 50-500 vehicles |

## Future Enhancements

The following features are **not yet implemented** but are natural extensions of the existing data model and infrastructure. The raw data (GPS with speed, fuel_level, engine_temp, odometer) already flows through the system — the business logic to act on it needs to be built.

### Priority 1: Vehicle Idle Time Tracking

**What exists**: A static `status` field on vehicles (`active` / `idle` / `maintenance`).

**What's needed**:
- Add `status_changed_at` timestamp to the vehicles table
- Compute idle duration: `NOW() - status_changed_at`
- Calculate idle percentage per vehicle over configurable time windows (7d, 30d, 90d)
- Dashboard widget showing "Vehicle X has been idle 62% of the last 30 days"
- Automatic idle detection from GPS data (speed = 0 for >30 minutes)

**Business value**: Enables fleet right-sizing. Identifies vehicles that should be sold, redeployed, or reassigned.

### Priority 2: Fuel Consumption & Cost Tracking

**What exists**: `fuel_level` percentage and `fuel_capacity` (gallons) are stored per vehicle and per GPS reading.

**What's needed**:
- Compute fuel consumed between readings: `(fuel_level_1 - fuel_level_2) / 100 * fuel_capacity`
- Calculate fuel efficiency: gallons per mile / liters per 100km
- Add fuel price constant (configurable per region)
- Cost per route: fuel consumed × price
- Cost per vehicle per month
- Efficiency comparison: actual MPG vs manufacturer spec

**Business value**: Fuel is typically 25-35% of fleet operating costs. Identifying waste directly impacts the bottom line.

### Priority 3: Predictive Maintenance

**What exists**: `engine_temp` and `odometer` are collected in every GPS reading.

**What's needed**:
- Engine temperature threshold alerts (e.g., >220°F triggers warning)
- Odometer-based maintenance scheduling (oil change every 5,000 miles, etc.)
- `maintenance_records` table tracking service history
- `next_service_due` computed from odometer + service interval
- Dashboard widget: "3 vehicles need service within 500 miles"

**Business value**: Prevents roadside breakdowns ($1,500-3,000 each) and extends vehicle lifespan.

### Priority 4: Driver Behavior Scoring

**What exists**: GPS readings include `speed`, `heading`, and `fuel_level`.

**What's needed**:
- Speed limit database (per road segment or configurable per fleet)
- Speeding event detection: `if (reading.speed > SPEED_LIMIT)`
- Harsh braking detection: rapid deceleration between consecutive readings
- Rapid acceleration detection: rapid acceleration between consecutive readings
- Driver safety score: composite metric from speeding, braking, acceleration events
- Driver leaderboard / ranking dashboard

**Business value**: Reduces accident risk, lowers insurance premiums, improves fuel efficiency.

### Priority 5: Route Optimization

**What exists**: Static routes with origin/destination coordinates and distance.

**What's needed**:
- Planned vs. actual route comparison (compare GPS breadcrumbs to intended path)
- Route deviation alerts
- Multi-stop route sequencing
- Integration with routing APIs (Google Maps, OSRM)
- Waypoint tracking

**Business value**: Reduces fuel waste from inefficient routing, improves delivery time accuracy.

### Priority 6: Compliance & HOS

**What exists**: Nothing — this is greenfield.

**What's needed**:
- Hours-of-service (HOS) logging per driver
- Driving time tracking (continuous and cumulative)
- Rest period enforcement
- ELD integration
- DOT audit trail

**Business value**: Avoids regulatory fines ($1,000-10,000 per violation).

## Technical Architecture Summary

```
React SPA (:3000) → Gateway (:4000) → Fleet-svc (:4001)    → PostgreSQL
                                  → Tracking-svc (:4002)   → PostgreSQL + Redis
                                  → Analytics-svc (:4003)  → PostgreSQL + Redis
                                  → Notification-svc (:4004) → Redis + WebSocket
```

**Stack**: Node.js 20, TypeScript 5.3, Express 4.18, PostgreSQL 16, Redis 7, React 18, Recharts, Leaflet

**For technical details**: See [Technical Architecture](README-architecture.md) and [Performance Testing](README-performance.md)
