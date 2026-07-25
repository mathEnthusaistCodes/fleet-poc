import React, { useEffect, useState, useCallback } from 'react';
import { api, API_BASE } from '../services/api';
import useMetricsStream from '../hooks/useMetricsStream';
import AnimatedNumber from '../components/AnimatedNumber';
import Sparkline from '../components/Sparkline';
import FleetHealthScore from '../components/FleetHealthScore';
import ActivityFeed from '../components/ActivityFeed';
import SystemHealthStrip from '../components/SystemHealthStrip';
import ThroughputGauge from '../components/ThroughputGauge';
import Badge from '../components/Badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Overview() {
  const { metrics, connected, method, getRpsHistory } = useMetricsStream();
  const [vehicles, setVehicles] = useState([]);
  const [utilization, setUtilization] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [vehRes, utilRes, alertRes, svcRes] = await Promise.all([
        api.getVehicles(),
        api.getUtilization(),
        api.getAlerts(),
        fetch(`${API_BASE}/services`).then(r => r.json()),
      ]);
      setVehicles(vehRes.data || []);
      setUtilization(utilRes.data?.vehicles || []);
      setAlerts((alertRes.data || []).slice(0, 20));
      setServices(svcRes.data || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (metrics.alerts && metrics.alerts.total > 0) {
      setAlerts(prev => {
        if (prev.length === 0) return prev;
        return prev;
      });
    }
  }, [metrics.alerts]);

  if (loading) return <div className="spinner" />;

  const chartData = utilization
    .slice()
    .sort((a, b) => b.total_distance - a.total_distance)
    .slice(0, 10)
    .map((v) => ({
      name: `${v.make} ${v.model}`,
      distance: Math.round(v.total_distance || 0),
      routes: v.total_routes || 0,
    }));

  const { fleet, gps, alerts: alertMetrics, rps, latency } = metrics;
  const rpsHistory = getRpsHistory();

  const cacheHitRate = metrics.cache?.hitRate || 0;

  return (
    <div>
      <SystemHealthStrip services={services} rps={rps['1s'] || 0} />

      <div className="overview-row overview-row-hero">
        <FleetHealthScore
          active={fleet.active}
          total={fleet.total}
          criticalAlerts={alertMetrics.critical}
        />
        <div className="overview-kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Active Vehicles</div>
            <div className="kpi-value">
              <AnimatedNumber value={fleet.active} />
              <span className="kpi-sub">/ {fleet.total}</span>
            </div>
            <div className="kpi-bar">
              <div
                className="kpi-bar-fill kpi-bar-active"
                style={{ width: `${fleet.total > 0 ? (fleet.active / fleet.total) * 100 : 0}%` }}
              />
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">GPS Readings</div>
            <div className="kpi-value">
              <AnimatedNumber value={gps.ratePerMin} />
              <span className="kpi-sub">/min</span>
            </div>
            <Sparkline
              data={rpsHistory.slice(-30).map(h => h.rps)}
              color="#38bdf8"
              height={30}
            />
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Active Alerts</div>
            <div className="kpi-value">
              <AnimatedNumber value={alertMetrics.total} />
            </div>
            <div className="kpi-alert-breakdown">
              <span className="kpi-alert-dot critical" /> {alertMetrics.critical}
              <span className="kpi-alert-dot warning" /> {alertMetrics.warning}
              <span className="kpi-alert-dot info" /> {alertMetrics.info}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Active Routes</div>
            <div className="kpi-value">
              <AnimatedNumber value={fleet.activeRoutes} />
            </div>
            <div className="kpi-sub">
              {fleet.idle} idle · {fleet.maintenance} maintenance
            </div>
          </div>
        </div>
      </div>

      <div className="overview-row">
        <div className="overview-col-wide">
          <div className="card">
            <h2>Throughput</h2>
            <ThroughputGauge rps={rps} rpsHistory={rpsHistory} />
          </div>
        </div>
        <div className="overview-col-narrow">
          <div className="card">
            <div className="latency-header">
              <h2>Latency</h2>
              <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
                {connected ? (method === 'sse' ? 'Live SSE' : 'Polling') : 'Offline'}
              </span>
            </div>
            <div className="latency-grid">
              <div className="latency-item">
                <span className="latency-label">Avg</span>
                <span className="latency-value">
                  <AnimatedNumber value={latency.avg} duration={300} />
                  <span className="latency-unit">ms</span>
                </span>
              </div>
              <div className="latency-item">
                <span className="latency-label">P50</span>
                <span className="latency-value">
                  <AnimatedNumber value={latency.p50} duration={300} />
                  <span className="latency-unit">ms</span>
                </span>
              </div>
              <div className="latency-item">
                <span className="latency-label">P95</span>
                <span className="latency-value">
                  <AnimatedNumber value={latency.p95} duration={300} />
                  <span className="latency-unit">ms</span>
                </span>
              </div>
              <div className="latency-item">
                <span className="latency-label">P99</span>
                <span className="latency-value">
                  <AnimatedNumber value={latency.p99} duration={300} />
                  <span className="latency-unit">ms</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Top Vehicle Utilization</h2>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <Bar dataKey="distance" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Distance (km)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="overview-row">
        <div className="overview-col-narrow">
          <div className="card">
            <h2>Recent Activity</h2>
            <ActivityFeed events={alerts.map(a => ({
              message: a.message,
              severity: a.severity,
              timestamp: a.created_at,
              type: a.type,
            }))} />
          </div>
        </div>
        <div className="overview-col-wide">
          <div className="card">
            <h2>Fleet Vehicles</h2>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Plate</th>
                    <th>Fuel</th>
                    <th>Status</th>
                    <th>Routes</th>
                    <th>Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {utilization.slice(0, 10).map((v) => (
                    <tr key={v.id}>
                      <td>{v.make} {v.model}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{vehicles.find(veh => veh.id === v.id)?.license_plate || '--'}</td>
                      <td>{vehicles.find(veh => veh.id === v.id)?.fuel_type || '--'}</td>
                      <td><Badge variant={v.status}>{v.status}</Badge></td>
                      <td>{v.total_routes || 0}</td>
                      <td>{Math.round(v.total_distance || 0)} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
