import React, { useRef, useEffect } from 'react';

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getDotColor(severity) {
  switch (severity) {
    case 'critical': return '#ef4444';
    case 'warning': return '#eab308';
    case 'info': return '#3b82f6';
    default: return '#38bdf8';
  }
}

export default function ActivityFeed({ events = [] }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="activity-feed">
        <div className="activity-feed-empty">
          No activity yet. Events will appear in real-time.
        </div>
      </div>
    );
  }

  return (
    <div className="activity-feed" ref={listRef}>
      {events.slice(0, 10).map((event, i) => (
        <div
          key={`${event.timestamp}-${i}`}
          className="activity-item"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div
            className="activity-dot"
            style={{ background: getDotColor(event.severity) }}
          />
          <div className="activity-content">
            <div className="activity-message">{event.message}</div>
            <div className="activity-time">{timeAgo(event.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
