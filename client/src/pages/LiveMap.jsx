import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { api } from '../services/api';
import Badge from '../components/Badge';

const POSITION_CLASSES = {
  lat: 39.8283,
  lng: -98.5795,
};

export default function LiveMap() {
  const [vehicles, setVehicles] = useState([]);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const vehRes = await api.getVehicles();
        const vehList = vehRes.data || [];
        setVehicles(vehList);

        const posMap = {};
        for (const v of vehList) {
          try {
            const pos = await api.getLatestPosition(v.id);
            posMap[v.id] = pos.data;
          } catch { /* no data yet */ }
        }
        setPositions(posMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="spinner" />;

  const center = [POSITION_CLASSES.lat, POSITION_CLASSES.lng];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title" style={{ marginBottom: 0 }}>Live Vehicle Tracking</h1>
        <span className="text-sm text-muted">{vehicles.length} vehicles · Refreshing every 30s</span>
      </div>

      <div className="map-container">
        <MapContainer center={center} zoom={4} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {vehicles.map((v) => {
            const pos = positions[v.id];
            if (!pos) return null;
            return (
              <Marker key={v.id} position={[pos.lat, pos.lng]}>
                <Popup>
                  <strong>{v.make} {v.model}</strong><br />
                  Plate: {v.license_plate}<br />
                  Speed: {pos.speed ? `${Math.round(pos.speed)} km/h` : 'N/A'}<br />
                  Fuel: {pos.fuel_level ? `${Math.round(pos.fuel_level)}%` : 'N/A'}<br />
                  Status: <Badge variant={v.status}>{v.status}</Badge>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
