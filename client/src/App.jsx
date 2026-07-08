import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Overview from './pages/Overview';
import LiveMap from './pages/LiveMap';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Performance from './pages/Performance';
import './styles.css';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="logo">🚛</span>
          <span className="brand-text">FleetPulse</span>
        </div>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Overview</NavLink>
          <NavLink to="/map" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Live Map</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Analytics</NavLink>
          <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Alerts</NavLink>
          <NavLink to="/performance" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Performance</NavLink>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/map" element={<LiveMap />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/performance" element={<Performance />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
