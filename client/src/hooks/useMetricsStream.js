import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../services/api';

const POLL_INTERVAL = 2000;
const RECONNECT_BASE = 1000;
const RECONNECT_MAX = 10000;

const DEFAULT_METRICS = {
  rps: { '1s': 0, '5s': 0, '30s': 0 },
  latency: { avg: 0, p50: 0, p95: 0, p99: 0 },
  gps: { ratePerMin: 0, lastMinute: 0 },
  fleet: { total: 0, active: 0, idle: 0, maintenance: 0, activeRoutes: 0 },
  alerts: { total: 0, critical: 0, warning: 0, info: 0 },
  wsConnections: 0,
  uptime: 0,
  timestamp: new Date().toISOString(),
};

export default function useMetricsStream() {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);
  const [connected, setConnected] = useState(false);
  const [method, setMethod] = useState('sse');
  const eventSourceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const rpsHistoryRef = useRef([]);

  const getRpsHistory = useCallback(() => rpsHistoryRef.current, []);

  const handleMetrics = useCallback((data) => {
    setMetrics(prev => {
      const next = { ...data };
      if (next.rps) {
        rpsHistoryRef.current = [
          ...rpsHistoryRef.current.slice(-59),
          { time: Date.now(), rps: next.rps['1s'] || 0 },
        ];
      }
      return next;
    });
  }, []);

  const startSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE}/analytics/metrics/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setMethod('sse');
      reconnectAttempt.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.error) {
          handleMetrics(data);
        }
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;
      const delay = Math.min(RECONNECT_BASE * Math.pow(2, reconnectAttempt.current), RECONNECT_MAX);
      reconnectAttempt.current++;
      setTimeout(startSSE, delay);
    };
  }, [handleMetrics]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;

    setMethod('polling');
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/analytics/metrics/snapshot`);
        const json = await res.json();
        if (json.success) {
          handleMetrics(json.data);
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
  }, [handleMetrics]);

  useEffect(() => {
    const tryConnect = async () => {
      try {
        const res = await fetch(`${API_BASE}/analytics/metrics/snapshot`);
        if (res.ok) {
          startSSE();
        } else {
          startPolling();
        }
      } catch {
        startPolling();
      }
    };

    tryConnect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [startSSE, startPolling]);

  return { metrics, connected, method, getRpsHistory };
}
