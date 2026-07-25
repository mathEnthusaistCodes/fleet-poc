import React, { useEffect, useState } from 'react';

function computeScore(active, total, criticalAlerts) {
  if (total === 0) return 0;
  const fleetScore = (active / total) * 40;
  const alertScore = criticalAlerts === 0 ? 30 : criticalAlerts <= 2 ? 20 : 10;
  const healthScore = 30;
  return Math.round(fleetScore + alertScore + healthScore);
}

function getLabel(score) {
  if (score >= 85) return { text: 'Excellent', color: '#22c55e' };
  if (score >= 70) return { text: 'Good', color: '#38bdf8' };
  if (score >= 50) return { text: 'Degraded', color: '#eab308' };
  return { text: 'Critical', color: '#ef4444' };
}

export default function FleetHealthScore({ active = 0, total = 0, criticalAlerts = 0 }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const score = computeScore(active, total, criticalAlerts);
  const { text, color } = getLabel(score);

  useEffect(() => {
    let frame;
    const from = animatedScore;
    const to = score;
    const start = performance.now();
    const duration = 1000;

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(from + (to - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;

  return (
    <div className="health-score-container">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
        />
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" fill="#f1f5f9" fontSize="28" fontWeight="700">
          {animatedScore}
        </text>
        <text x="70" y="85" textAnchor="middle" fill={color} fontSize="12" fontWeight="600">
          {text}
        </text>
      </svg>
      <div className="health-score-label">Fleet Health</div>
    </div>
  );
}
