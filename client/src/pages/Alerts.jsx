import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import Badge from '../components/Badge';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef(null);

  useEffect(() => {
    api.getAlerts()
      .then((res) => setAlerts(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsPort = process.env.NODE_ENV === 'production' ? window.location.port : '4004';
    const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}/ws/alerts`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'alert') {
        setAlerts((prev) => [msg.data, ...prev].slice(0, 100));
      }
    };

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'critical': return 'critical';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Alerts & Notifications</h1>
        <span className="text-sm text-muted">Connected: {wsRef.current?.readyState === WebSocket.OPEN ? '🟢 Live' : '🔴 Disconnected'}</span>
      </div>

      <div className="card">
        <div className="alert-list">
          {alerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
              No alerts yet. They will appear here in real-time.
            </div>
          )}
          {alerts.map((alert) => (
            <div key={alert.id} className={`alert-item ${getSeverityClass(alert.severity)}`}>
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-4" style={{ marginBottom: 4 }}>
                  <Badge variant={alert.severity}>{alert.severity}</Badge>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{alert.type}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Vehicle: {alert.vehicle_id.slice(0, 8)}</span>
                </div>
                <div>{alert.message}</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{formatTime(alert.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
