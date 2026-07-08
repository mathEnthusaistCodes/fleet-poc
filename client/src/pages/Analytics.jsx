import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [utilization, setUtilization] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSummary(), api.getUtilization()])
      .then(([s, u]) => {
        setSummary(s.data);
        setUtilization(u.data.vehicles || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const statusData = [
    { name: 'Active', value: utilization.filter((v) => v.status === 'active').length },
    { name: 'Idle', value: utilization.filter((v) => v.status === 'idle').length },
    { name: 'Maintenance', value: utilization.filter((v) => v.status === 'maintenance').length },
  ];

  const topVehicles = utilization
    .slice()
    .sort((a, b) => b.total_distance - a.total_distance)
    .slice(0, 8)
    .map((v) => ({ name: `${v.make} ${v.model}`, distance: Math.round(v.total_distance || 0), routes: v.total_routes || 0 }));

  return (
    <div>
      <h1 className="page-title">Fleet Analytics</h1>

      {summary && (
        <div className="stats-grid">
          <StatCard label="Total Vehicles" value={summary.total_vehicles} />
          <StatCard label="Active Vehicles" value={summary.active_vehicles} sub={`${Math.round((summary.active_vehicles / summary.total_vehicles) * 100)}% utilization`} />
          <StatCard label="Avg Route Distance" value={`${summary.avg_route_distance} km`} />
          <StatCard label="Total GPS Data Points" value={summary.total_gps_readings.toLocaleString()} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="card">
          <h2>Vehicle Status Distribution</h2>
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8' }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="value" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Vehicles" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2>Top Vehicles by Distance</h2>
          <div className="chart-container" style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVehicles}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                <Bar dataKey="distance" fill="#22c55e" radius={[4, 4, 0, 0]} name="Distance (km)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
