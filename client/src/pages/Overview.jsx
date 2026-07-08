import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import VehicleTable from '../components/VehicleTable';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function Overview() {
  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getSummary(), api.getUtilization()])
      .then(([summaryRes, utilRes]) => {
        setSummary(summaryRes.data);
        setVehicles(utilRes.data.vehicles || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;

  const chartData = vehicles.slice(0, 10).map((v) => ({
    name: `${v.make} ${v.model}`,
    distance: Math.round(v.total_distance || 0),
    routes: v.total_routes || 0,
  }));

  return (
    <div>
      <h1 className="page-title">Fleet Overview</h1>

      {summary && (
        <div className="stats-grid">
          <StatCard label="Total Vehicles" value={summary.total_vehicles} sub={`${summary.active_vehicles} active`} trend={12} />
          <StatCard label="Avg Fuel Capacity" value={`${summary.avg_fuel_capacity}L`} sub="Across all vehicles" />
          <StatCard label="Avg Route Distance" value={`${summary.avg_route_distance} km`} sub="Completed routes" />
          <StatCard label="GPS Readings" value={summary.total_gps_readings.toLocaleString()} sub="Total tracked" trend={8} />
        </div>
      )}

      <div className="card">
        <h2>Top Vehicle Utilization (by distance)</h2>
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

      <div className="card">
        <h2>All Vehicles</h2>
        <VehicleTable vehicles={vehicles} />
      </div>
    </div>
  );
}
