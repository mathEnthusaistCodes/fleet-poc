import React from 'react';
import AnimatedNumber from './AnimatedNumber';
import Sparkline from './Sparkline';

export default function ThroughputGauge({ rps = {}, rpsHistory = [] }) {
  const rps1 = rps['1s'] || 0;
  const rps5 = rps['5s'] || 0;
  const rps30 = rps['30s'] || 0;

  const getColor = (val) => {
    if (val > 500) return '#ef4444';
    if (val > 200) return '#eab308';
    return '#22c55e';
  };

  const sparkData = rpsHistory.map(h => h.rps);

  return (
    <div className="throughput-gauge">
      <div className="throughput-main">
        <div className="throughput-value">
          <AnimatedNumber value={rps1} duration={400} className="throughput-number" />
          <span className="throughput-unit" style={{ color: getColor(rps1) }}>req/s</span>
        </div>
        <Sparkline data={sparkData} color={getColor(rps1)} height={50} width={200} />
      </div>
      <div className="throughput-breakdown">
        <div className="throughput-window">
          <span className="throughput-window-label">1s</span>
          <AnimatedNumber value={rps1} duration={300} />
        </div>
        <div className="throughput-window">
          <span className="throughput-window-label">5s avg</span>
          <AnimatedNumber value={rps5} duration={300} />
        </div>
        <div className="throughput-window">
          <span className="throughput-window-label">30s avg</span>
          <AnimatedNumber value={rps30} duration={300} />
        </div>
      </div>
    </div>
  );
}
