export const API_BASE = window.REACT_APP_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new ApiError(res.status, json.error?.message || 'Request failed');
  return json;
}

export const api = {
  // Fleet
  getVehicles: () => request('/vehicles'),
  getVehicle: (id) => request(`/vehicles/${id}`),
  // Tracking
  getTracking: (vehicleId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tracking/${vehicleId}${qs ? `?${qs}` : ''}`);
  },
  getLatestPosition: (vehicleId) => request(`/tracking/${vehicleId}/latest`),
  // Analytics
  getSummary: () => request('/analytics/summary'),
  getVehicleAnalytics: (id) => request(`/analytics/vehicle/${id}`),
  getUtilization: () => request('/analytics/fleet/utilization'),
  // Alerts
  getAlerts: () => request('/alerts'),
};
