import React from 'react';

const SERVICES = [
  { key: 'gateway', label: 'Gateway', icon: '🌐' },
  { key: 'fleet-svc', label: 'Fleet', icon: '🚛' },
  { key: 'tracking-svc', label: 'Tracking', icon: '📡' },
  { key: 'analytics-svc', label: 'Analytics', icon: '📊' },
  { key: 'notification-svc', label: 'Alerts', icon: '🔔' },
];

export default function SystemHealthStrip({ services = {}, rps = 0 }) {
  return (
    <div className="health-strip">
      <div className="health-strip-header">
        <span className="health-strip-title">System Status</span>
        <span className="health-strip-rps">
          <span className="health-rps-dot" />
          {rps} req/s
        </span>
      </div>
      <div className="health-strip-items">
        {SERVICES.map(({ key, label, icon }) => {
          const svc = services[key];
          const isOk = svc && svc.status === 'ok';
          const statusClass = isOk ? 'ok' : svc ? 'warn' : 'unknown';

          return (
            <div key={key} className={`health-strip-item ${statusClass}`}>
              <div className={`health-dot health-dot-${statusClass}`} />
              <span className="health-icon">{icon}</span>
              <span className="health-name">{label}</span>
              {svc && (
                <span className="health-latency">
                  {svc.latencyMs != null ? `${svc.latencyMs}ms` : '...'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
