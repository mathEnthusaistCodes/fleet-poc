# FleetPOC — Performance Testing Guide

## Overview

FleetPOC includes a **built-in load testing engine** accessible directly from the browser. No external tools required. The Performance page lets you simulate realistic traffic patterns, measure system response, and validate that the architecture handles production-level load.

## Quick Start

```bash
# 1. Start all services
docker-compose up --build

# 2. Seed data + start live stream
npm run generate-data-live

# 3. Open the Performance page
# Navigate to http://localhost:3000/performance
```

## Load Test Configuration

The Performance page provides three controls:

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| **Concurrent Users** | 1-500 | 10 | Number of simultaneous request streams |
| **Duration** | 1-30 seconds | 5 | How long the test runs |
| **Simulated Region** | 5 options | us-east (0ms) | Adds artificial latency to simulate geographic distance |

### Simulated Regions

| Region | Added Latency | Use Case |
|--------|--------------|----------|
| us-east (N. Virginia) | 0ms | Baseline — same region as server |
| us-west (Oregon) | +40ms | Cross-continent US |
| eu-west (Ireland) | +85ms | Transatlantic |
| ap-southeast (Singapore) | +200ms | US to Asia-Pacific |
| sa-east (Sao Paulo) | +280ms | US to South America |

## What the Load Test Does

When you click **Run Load Test**, the system:

1. **Spawns N concurrent workers** (where N = your "Concurrent Users" setting)
2. **Each worker fires requests** for the duration you specified
3. **Requests target a mix** of endpoints:
   - `GET /api/vehicles` — Cache-miss path (hits PostgreSQL)
   - `GET /api/analytics/summary` — Cache-hit path (served from Redis)
   - `GET /api/analytics/fleet/utilization` — Cache-hit path
   - `GET /api/routes` — Cache-miss path
4. **The gateway applies** rate limiting and circuit breaker logic to each request
5. **Results stream back** with per-request timing, error tracking, and cache hit/miss recording

### Why This Mix Matters

The test deliberately mixes **cache-miss** (database) and **cache-hit** (Redis) endpoints to demonstrate:

- **Cache performance advantage**: Cache hits return in ~1ms vs ~10-50ms for database queries
- **Throughput ceiling**: How many requests/second the system sustains before errors appear
- **Error behavior**: Whether the circuit breaker trips under load

## Metrics Explained

### Primary Metrics

| Metric | What It Measures | Good Value |
|--------|-----------------|------------|
| **Total Requests** | Requests completed during the test | Higher = better throughput |
| **Requests/Second** | Throughput rate | >50 req/s for small fleet, >500 for production |
| **Error Rate** | Failed requests / total | <1% is healthy, >5% needs investigation |
| **Cache Hit Rate** | Cache hits / total cache-eligible requests | >80% after warm-up |

### Latency Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| **Avg Response Time** | Mean across all requests | <50ms |
| **P50 (Median)** | 50th percentile | <20ms |
| **P95** | 95th percentile | <100ms |
| **Min** | Fastest request | ~1ms (cache hit) |
| **Max** | Slowest request | <500ms |

### Understanding the Latency Bar Chart

The Performance page shows a **bar chart comparing Avg/P95/Min/Max** response times. This reveals:

- **Large gap between Min and Avg**: Indicates cache hits are very fast but some database queries are slow
- **P95 much higher than Avg**: Tail latency issue — most requests are fast but a few are slow (likely cold cache or connection pool wait)
- **Max approaching 500ms**: Potential bottleneck — check if circuit breaker is tripping

## SLA Dashboard

The Performance page includes a **Cloud SLA Dashboard** that tracks:

| SLA Metric | Target | How It's Calculated |
|-----------|--------|-------------------|
| **Availability** | 99% | Requests that complete (regardless of response time) |
| **Latency SLA** | <500ms | Requests completing under 500ms |
| **Compliance Rate** | 99% | Percentage of requests meeting both targets |

### SLA Grades

| Grade | Compliance | Meaning |
|-------|-----------|---------|
| **A** | ≥99.5% | Production-ready |
| **B** | ≥99% | Acceptable for most workloads |
| **C** | ≥95% | Needs optimization |
| **D** | ≥90% | Not production-ready |
| **F** | <90% | System under stress |

## Circuit Breaker Behavior

The gateway's circuit breaker is visible during load tests. Watch for these states:

| State | Visual | What's Happening |
|-------|--------|-----------------|
| **CLOSED** | Green | Normal operation. Requests flow freely. |
| **OPEN** | Red | Too many failures. Requests blocked immediately (503). |
| **HALF-OPEN** | Yellow | Cooldown period ended. One probe request allowed through. |

### Circuit Breaker During Load Tests

With high concurrency (200+ users), you may see:

1. **CLOSED → OPEN**: If a downstream service (fleet-svc, tracking-svc) can't handle the load
2. **OPEN → HALF-OPEN → CLOSED**: Service recovers after 30s cooldown
3. **Repeated OPEN**: Service is genuinely overwhelmed — reduce concurrent users

## Cache Performance

### Cache Hit Rate Analysis

The **Cache Statistics** panel shows:

```
Cache Hits:    847 (84.7%)
Cache Misses:  153 (15.3%)
Total:         1000
```

### Why Cache Hit Rate Varies

| Phase | Hit Rate | Explanation |
|-------|----------|-------------|
| **First 5 seconds** | 0-30% | Cache cold — all requests hit database |
| **After warm-up** | 70-90% | Most analytics queries served from Redis |
| **After 60 seconds** | 80-95% | Cache fully populated |
| **After cache reset** | 0% | `GET /api/analytics/refresh` clears all cache |

### Cache Hit vs Miss Performance

```
Cache Hit:    ~1ms   (Redis GET)
Cache Miss:   ~10-50ms (PostgreSQL SELECT)
```

The Performance page's **pie chart** visualizes this ratio. A healthy system should show >80% cache hits after the first 10 seconds of a test.

## Multi-Region Testing

The Performance page records test history with region labels. The **Multi-Region Test History** chart shows:

- **Avg Response Time** per region over time
- **P95 Response Time** per region
- **Throughput** (req/s) per region

### Expected Results by Region

| Region | Expected Avg | Expected P95 | Expected Throughput |
|--------|-------------|-------------|-------------------|
| us-east (0ms) | 5-15ms | 30-80ms | 100-500 req/s |
| us-west (+40ms) | 45-55ms | 70-120ms | 80-400 req/s |
| eu-west (+85ms) | 90-100ms | 120-180ms | 60-300 req/s |
| ap-southeast (+200ms) | 205-215ms | 230-300ms | 40-200 req/s |
| sa-east (+280ms) | 285-295ms | 310-400ms | 30-150 req/s |

### Key Insight

The simulated region latency is **added on top of actual processing time**. This demonstrates that:

- **Local processing** (cache + database) contributes 5-15ms
- **Network latency** dominates for distant regions
- **For production**: Deploy analytics-svc in the same region as your dashboard users

## Deployment Cost Estimator

The Performance page includes a **cost estimator** that calculates:

```
Estimated Monthly Cost = (Instances × $50) + (Requests/1K × $0.01)
```

This helps answer: "How many server instances do we need for our traffic?"

### Cost Scenarios

| Scenario | Requests/Day | Instances | Monthly Cost |
|----------|-------------|-----------|-------------|
| Small fleet (20 vehicles) | 500K | 1 | $55 |
| Medium fleet (100 vehicles) | 5M | 2 | $150 |
| Large fleet (500 vehicles) | 50M | 4 | $700 |
| Enterprise (2000 vehicles) | 500M | 8 | $5,800 |

## Running Tests: Step by Step

### Basic Load Test

1. Navigate to **http://localhost:3000/performance**
2. Set **Concurrent Users** to 50
3. Set **Duration** to 10 seconds
4. Leave **Region** as us-east (0ms)
5. Click **Run Load Test**
6. Watch the results populate in real-time

### Stress Test

1. Set **Concurrent Users** to 200
2. Set **Duration** to 30 seconds
3. Set **Region** to eu-west (Ireland)
4. Click **Run Load Test**
5. Observe:
   - Latency increases as connection pool saturates
   - Cache hit rate stabilizes at 80-90%
   - Circuit breaker may open briefly then recover

### Multi-Region Comparison

1. Run test with **us-east** — record results
2. Switch to **eu-west** — run same test
3. Switch to **ap-southeast** — run same test
4. Compare results in the **Multi-Region Test History** chart

### Cache Behavior Test

1. Click **Reset Cache Stats** to clear counters
2. Run a short test (10 users, 5 seconds)
3. Note the cache hit rate (likely 0-30%)
4. Run the same test again immediately
5. Note the cache hit rate (now 80-95%)

## What the Metrics Page Shows (Overview Dashboard)

The Overview page (`/`) displays **live system metrics** via SSE:

| Component | Data Source | Update Frequency |
|-----------|-----------|-----------------|
| System Health Strip | Gateway + service health checks | Every 5s |
| Fleet Health Score | Vehicle status + alert severity | Every 1s |
| KPI Cards | PostgreSQL aggregation | Every 1s |
| Throughput Gauge | In-memory RPS counter | Every 1s |
| Latency Grid | In-memory latency percentiles | Every 1s |
| Activity Feed | Redis alerts:history list | Every 1s |

These metrics reflect **real traffic** from the live data generator. When you run a load test, the RPS gauge and latency grid will spike in real-time.

## Interpreting Results

### Healthy System Signature

```
✓ Error rate: <1%
✓ Cache hit rate: >80% (after warm-up)
✓ P95 latency: <100ms (same region)
✓ Circuit breaker: Stays CLOSED
✓ Throughput: >50 req/s
```

### Degraded System Warning Signs

```
✗ Error rate: >5% — Check circuit breaker state
✗ Cache hit rate: <50% — Cache may be too small or TTL too short
✗ P95 latency: >200ms — Database connection pool may be exhausted
✗ Circuit breaker: OPEN — Downstream service is failing
✗ Throughput plateaus while errors increase — System at capacity
```

### Common Issues and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| High error rate | Circuit breaker tripping | Reduce concurrent users or increase `CIRCUIT_THRESHOLD` |
| Low cache hit rate | Cache cleared recently | Wait 30s for cache to warm up |
| High P95, low avg | Tail latency | Check PostgreSQL connection pool size |
| Throughput drops over time | Memory pressure | Check container memory limits |
| 429 errors | Rate limit hit | Increase `RATE_LIMIT_MAX` in gateway |

## Architecture Validation

The load test validates several architectural decisions:

1. **Redis caching** — Cache hits are 10-50x faster than database queries
2. **Circuit breakers** — Prevent cascade failures when a service is overwhelmed
3. **Rate limiting** — Protects backend services from traffic spikes
4. **Connection pooling** — PostgreSQL connections are reused across requests
5. **Batch ingestion** — GPS batch endpoint handles 1000 readings in one transaction
6. **SSE streaming** — Real-time metrics update without polling overhead

## Test Automation

The load test can also be triggered via API:

```bash
# Run 100 concurrent users for 20 seconds
curl -X POST http://localhost:4000/api/analytics/loadtest \
  -H "Content-Type: application/json" \
  -d '{"concurrent": 100, "duration": 20}'
```

Response:
```json
{
  "success": true,
  "data": {
    "total_requests": 15234,
    "errors": 12,
    "error_rate": "0.08%",
    "cache_hits": 12187,
    "cache_hit_rate": "80.0%",
    "avg_response_time": "12.3ms",
    "p95_response_time": "45.6ms",
    "min_response_time": "0.8ms",
    "max_response_time": "234.5ms",
    "requests_per_second": 761.7,
    "test_duration": "20.0s"
  }
}
```

This enables CI/CD integration — run load tests on every deployment to catch performance regressions.
