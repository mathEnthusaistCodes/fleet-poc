import React from 'react';
import Badge from './Badge';

export default function VehicleTable({ vehicles }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Make</th>
            <th>Model</th>
            <th>Year</th>
            <th>License Plate</th>
            <th>Fuel Type</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id}>
              <td>{v.make}</td>
              <td>{v.model}</td>
              <td>{v.year}</td>
              <td>{v.license_plate}</td>
              <td>{v.fuel_type}</td>
              <td><Badge variant={v.status}>{v.status}</Badge></td>
            </tr>
          ))}
          {vehicles.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>No vehicles found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
