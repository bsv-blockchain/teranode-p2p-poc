import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import Peers from './components/Peers';
import PeerDetail from './components/PeerDetail';
import Stats from './components/Stats';
import { BlockExplorer } from './components/BlockExplorer';
import Networks from './components/Networks';
import './App.css';

function Navigation() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    
    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileMenuOpen]);
  
  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);
  
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200" ref={menuRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Teranode P2P Monitor</h1>
            </div>
            {/* Desktop Navigation */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/' 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/stats"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/stats' 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Stats
              </Link>
              <Link
                to="/peers"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname.startsWith('/peers') 
                    ? 'border-blue-500 text-gray-900' 
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Peers
              </Link>
              <Link
                to="/blocks"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/blocks'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Blocks
              </Link>
              <Link
                to="/networks"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  location.pathname === '/networks'
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                Networks
              </Link>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              <svg 
                className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              {/* Close icon */}
              <svg 
                className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu dropdown */}
      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1">
          <Link
            to="/"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              location.pathname === '/' 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } border-l-4`}
          >
            Dashboard
          </Link>
          <Link
            to="/stats"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              location.pathname === '/stats' 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } border-l-4`}
          >
            Stats
          </Link>
          <Link
            to="/peers"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              location.pathname.startsWith('/peers') 
                ? 'bg-blue-50 border-blue-500 text-blue-700' 
                : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } border-l-4`}
          >
            Peers
          </Link>
          <Link
            to="/blocks"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              location.pathname === '/blocks'
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } border-l-4`}
          >
            Blocks
          </Link>
          <Link
            to="/networks"
            className={`block px-3 py-2 rounded-md text-base font-medium ${
              location.pathname === '/networks'
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
            } border-l-4`}
          >
            Networks
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        {/* Routes */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/peers" element={<Peers />} />
          <Route path="/peers/:peerID" element={<PeerDetail />} />
          <Route path="/blocks" element={<BlockExplorer />} />
          <Route path="/networks" element={<Networks />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;