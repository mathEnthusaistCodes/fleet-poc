import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts';

const API = 'http://localhost:4000/api';
const REGIONS = [
  { label: 'us-east (N. Virginia)', value: 0 },
  { label: 'us-west (Oregon)', value: 40 },
  { label: 'eu-west (Ireland)', value: 85 },
  { label: 'ap-southeast (Singapore)', value: 200 },
  { label: 'sa-east (São Paulo)', value: 280 },
];

export default function Performance() {
  const [concurrent, setConcurrent] = useState(50);
  const [duration, setDuration] = useState(5);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [cacheStats, setCacheStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [gatewayStatus, setGatewayStatus] = useState(null);
  const [region, setRegion] = useState(REGIONS[0]);
  const [slaData, setSlaData] = useState({ total: 0, compliant: 0, slaTarget: 99.0 });
  const [showCloud, setShowCloud] = useState(false);
  const [scalingHistory, setScalingHistory] = useState([]);
  const runningRef = useRef(false);

  useEffect(() => {
    fetch(`${API}/gateway/status`).then(r => r.json()).then(j => setGatewayStatus(j.data)).catch(() => {});
    fetch(`${API}/analytics/loadtest/cache-stats`).then(r => r.json()).then(j => setCacheStats(j.data)).catch(() => {});
  }, []);

  const runTest = async () => {
    setRunning(true);
    setError('');
    runningRef.current = true;
    const slaBefore = { ...slaData };
    try {
      const res = await fetch(`${API}/analytics/loadtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrent, duration }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(errBody || 'Load test failed');
      }
      const json = await res.json();

      const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0');
      const limit = parseInt(res.headers.get('X-RateLimit-Limit') || '0');

      const enhancedResult = {
        ...json.data,
        rateLimitRemaining: remaining,
        rateLimitTotal: limit,
        region: region.label,
      };

      setResult(enhancedResult);
      setHistory(prev => [{ ...enhancedResult, id: Date.now() }, ...prev].slice(0, 20));

      // Track SLA: requests under 500ms are compliant
      const newTotal = slaBefore.total + json.data.total_requests;
      const newCompliant = slaBefore.compliant + (json.data.avg_response_time_ms < 500 ? json.data.total_requests : 0);
      setSlaData({ total: newTotal, compliant: newCompliant, slaTarget: 99.0 });

      // Save scaling comparison
      setScalingHistory(prev => [...prev, {
        id: Date.now(),
        label: `Test ${prev.length + 1}`,
        concurrent: json.data.config.concurrent,
        avg: json.data.avg_response_time_ms,
        p95: json.data.p95_response_time_ms,
        rps: json.data.requests_per_second,
        instances: gatewayStatus?.scaling || 1,
        region: region.label,
      }]);
      setShowCloud(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
      runningRef.current = false;
    }
  };

  const loadCacheStats = async () => {
    try {
      const res = await fetch(`${API}/analytics/loadtest/cache-stats`);
      const json = await res.json();
      setCacheStats(json.data);
    } catch {}
  };

  const resetCacheStats = async () => {
    await fetch(`${API}/analytics/loadtest/cache-stats/reset`, { method: 'POST' });
    setCacheStats(null);
    setShowCloud(false);
  };

  const slaCompliance = slaData.total > 0 ? ((slaData.compliant / slaData.total) * 100).toFixed(2) : '--';
  const slaPassing = slaData.total > 0 ? parseFloat(slaCompliance) >= slaData.slaTarget : true;

  const COLORS = ['#22c55e', '#38bdf8', '#eab308', '#ef4444', '#a855f7'];

  return (
    <div>
      <h1 className="page-title">Performance & Cloud Deployment</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        <div className="card">
          <h2>Load Test Configuration</h2>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#94a3b8', fontSize: 14 }}>
              Concurrent Users: <strong style={{ color: '#38bdf8' }}>{concurrent}</strong>
            </label>
            <input type="range" min="1" max="500" value={concurrent}
              onChange={(e) => setConcurrent(Number(e.target.value))}
              disabled={running}
              style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#94a3b8', fontSize: 14 }}>
              Duration: <strong style={{ color: '#38bdf8' }}>{duration}s</strong>
            </label>
            <input type="range" min="1" max="30" value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={running}
              style={{ width: '100%', accentColor: '#38bdf8' }} />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#94a3b8', fontSize: 14 }}>
              Simulated Region: <strong style={{ color: '#38bdf8' }}>{region.label}</strong>
            </label>
            <select value={region.value}
              onChange={(e) => {
                const r = REGIONS.find(r => r.value === parseInt(e.target.value)) || REGIONS[0];
                setRegion(r);
              }}
              disabled={running}
              style={{
                width: '100%', padding: '10px 12px', background: '#0f172a', color: '#e2e8f0',
                border: '1px solid #334155', borderRadius: 6, fontSize: 14,
              }}>
              {REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label} {r.value > 0 ? `(+${r.value}ms)` : ''}</option>
              ))}
            </select>
          </div>

          <button onClick={runTest} disabled={running}
            style={{
              width: '100%', padding: '12px 24px', fontSize: 16, fontWeight: 600,
              background: running ? '#334155' : '#38bdf8', color: running ? '#94a3b8' : '#0f172a',
              border: 'none', borderRadius: 8, cursor: running ? 'not-allowed' : 'pointer',
            }}>
            {running ? 'Running Test...' : '🚀 Run Load Test'}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 14 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <h2>☁️ Cloud SLA Dashboard</h2>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: slaPassing ? '#22c55e' : '#ef4444' }}>
                {slaCompliance}%
              </div>
              <div style={{ fontSize: 13, color: '#64748b' }}>SLA Compliance (target: {slaData.slaTarget}%)</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#0f172a', borderRadius: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>{slaData.total.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Requests</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: 8, background: '#0f172a', borderRadius: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#22c55e' }}>{slaData.compliant.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Compliant</div>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#475569', textAlign: 'center' }}>
              SLA: response &lt; 500ms · {slaPassing ? '✅ Meeting target' : '❌ Below target'}
            </div>
          </div>

          <div className="card" style={{ flex: 1 }}>
            <h2>🔄 Circuit Breaker</h2>
            {gatewayStatus && Object.keys(gatewayStatus.circuits || {}).length > 0 ? (
              Object.entries(gatewayStatus.circuits).map(([svc, state]) => (
                <div key={svc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: state.open ? '#ef4444' : '#22c55e',
                    display: 'inline-block',
                  }} />
                  <span style={{ color: '#94a3b8', flex: 1 }}>{svc}</span>
                  <span style={{ color: state.open ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                    {state.open ? 'OPEN' : state.halfOpen ? 'HALF-OPEN' : 'CLOSED'}
                  </span>
                  <span style={{ color: '#64748b', fontSize: 11 }}>({state.failures} failures)</span>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontSize: 13 }}>All circuits closed · No failures detected</div>
            )}
          </div>
        </div>
      </div>

      {showCloud && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="card">
            <h2>Rate Limiting & Cache</h2>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="stat-card">
                <div className="label">Rate Limit Remaining</div>
                <div className="value" style={{ color: (result?.rateLimitRemaining || 0) > 50 ? '#22c55e' : '#eab308' }}>
                  {result?.rateLimitRemaining ?? '-'} / {result?.rateLimitTotal ?? '-'}
                </div>
              </div>
              <div className="stat-card">
                <div className="label">Cache Hit Rate</div>
                <div className="value" style={{ color: '#22c55e' }}>{result?.cache_hit_rate ?? '-'}%</div>
              </div>
              <div className="stat-card">
                <div className="label">Region Latency</div>
                <div className="value" style={{ color: '#a855f7' }}>{region.value}ms</div>
              </div>
            </div>
            {cacheStats && (
              <div style={{ marginTop: 12, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'Cache Hits', value: cacheStats.hits || 1 },
                      { name: 'Cache Misses', value: cacheStats.misses || 0 },
                    ]} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      <Cell fill="#22c55e" />
                      <Cell fill="#334155" />
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <button onClick={resetCacheStats} style={{ marginTop: 8, padding: '8px 16px', background: '#334155', border: 'none', borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 13 }}>
              Reset Cache Stats
            </button>
          </div>

          <div className="card">
            <h2>Deployment Cost Estimator</h2>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
                <span style={{ color: '#94a3b8' }}>Service Instances</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{gatewayStatus ? Object.keys(gatewayStatus.services).length : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
                <span style={{ color: '#94a3b8' }}>Requests Processed</span>
                <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{result?.total_requests?.toLocaleString() || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b', fontSize: 14 }}>
                <span style={{ color: '#94a3b8' }}>Est. Monthly Cost</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                  ~${(Object.keys(gatewayStatus?.services || {}).length * 50 + (result?.total_requests || 0) * 0.00001).toFixed(0)}/mo
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 }}>
                <span style={{ color: '#94a3b8' }}>Cloud Region</span>
                <span style={{ color: '#a855f7', fontWeight: 600 }}>{region.label}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#475569', padding: '8px', background: '#0f172a', borderRadius: 6 }}>
              💡 Based on $50/instance/month + $0.01/1K requests (AWS/GCP pricing model)
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <h2>Test Results {region.value > 0 && <span style={{ color: '#a855f7', fontSize: 14 }}>— {region.label} (+{region.value}ms simulated)</span>}</h2>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <div className="stat-card">
              <div className="label">Total Requests</div>
              <div className="value">{result.total_requests.toLocaleString()}</div>
            </div>
            <div className="stat-card">
              <div className="label">Avg Response</div>
              <div className="value" style={{ color: result.avg_response_time_ms < 150 ? '#22c55e' : result.avg_response_time_ms < 400 ? '#eab308' : '#ef4444' }}>
                {result.avg_response_time_ms}ms
              </div>
            </div>
            <div className="stat-card">
              <div className="label">P95 Response</div>
              <div className="value" style={{ color: result.p95_response_time_ms < 300 ? '#22c55e' : '#eab308' }}>
                {result.p95_response_time_ms}ms
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Throughput</div>
              <div className="value" style={{ color: '#38bdf8' }}>{result.requests_per_second} req/s</div>
            </div>
            <div className="stat-card">
              <div className="label">Error Rate</div>
              <div className="value" style={{ color: result.error_rate > 5 ? '#ef4444' : '#22c55e' }}>{result.error_rate}%</div>
            </div>
            <div className="stat-card">
              <div className="label">Cache Hit Rate</div>
              <div className="value" style={{ color: '#22c55e' }}>{result.cache_hit_rate}%</div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12, color: '#f1f5f9' }}>Response Time Breakdown</h3>
            <div className="chart-container" style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Avg', value: result.avg_response_time_ms, fill: '#38bdf8' },
                  { name: 'P95', value: result.p95_response_time_ms, fill: '#eab308' },
                  { name: 'Max', value: result.max_response_time_ms, fill: '#ef4444' },
                  { name: 'Min', value: result.min_response_time_ms, fill: '#22c55e' },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                  <YAxis tick={{ fill: '#94a3b8' }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Response Time (ms)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {history.length > 1 && (
        <div className="card">
          <h2>Multi-Region Test History</h2>
          <div className="chart-container" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...history].reverse()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="region" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="avg_response_time_ms" stroke="#38bdf8" name="Avg (ms)" dot={{ fill: '#38bdf8' }} />
                <Line type="monotone" dataKey="p95_response_time_ms" stroke="#eab308" name="P95 (ms)" dot={{ fill: '#eab308' }} />
                <Line type="monotone" dataKey="requests_per_second" stroke="#22c55e" name="Req/s" dot={{ fill: '#22c55e' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
