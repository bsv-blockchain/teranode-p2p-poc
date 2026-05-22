import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import Peers from './components/Peers';
import PeerDetail from './components/PeerDetail';
import Stats from './components/Stats';
import Networks from './components/Networks';
import { OverviewPrefsProvider, Shell } from './components/overview/Shell';
import './App.css';

function RoutedShell() {
  const location = useLocation();
  // Footer only on the marketing landing.
  const showFooter = location.pathname === '/';
  return (
    <Shell showFooter={showFooter}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/peers" element={<Peers />} />
        <Route path="/peers/:peerID" element={<PeerDetail />} />
        <Route path="/networks" element={<Networks />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

function App() {
  return (
    <Router>
      <OverviewPrefsProvider>
        <RoutedShell />
      </OverviewPrefsProvider>
    </Router>
  );
}

export default App;
