import React, { useState, useEffect } from 'react';
import { PeerNamesService } from '../services/peerNames';
import { PeerNameDisplay } from './PeerNameDisplay';

interface PeerFilterProps {
  value: string;
  onChange: (peer: string) => void;
  placeholder?: string;
  recentPeers?: string[];
}

export const PeerFilter: React.FC<PeerFilterProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Filter by peer ID...',
  recentPeers = []
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredPeers, setFilteredPeers] = useState<string[]>([]);

  useEffect(() => {
    if (value && recentPeers.length > 0) {
      const searchLower = value.toLowerCase();
      const filtered = recentPeers.filter(peer => {
        const friendlyName = PeerNamesService.getName(peer);
        return peer.toLowerCase().includes(searchLower) ||
               (friendlyName && friendlyName.toLowerCase().includes(searchLower));
      });
      setFilteredPeers(filtered.slice(0, 5));
    } else {
      setFilteredPeers([]);
    }
  }, [value, recentPeers]);

  const handleSelect = (peer: string) => {
    onChange(peer);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-800">Peer Filter</label>
        {recentPeers.length > 0 && (
          <span className="text-xs text-gray-500">{recentPeers.length} recent peers</span>
        )}
      </div>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#1B1EA9] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search by peer ID or name..."
          className="block w-full pl-10 pr-10 py-3.5 text-sm font-medium text-gray-800 bg-white border-2 border-gray-200 rounded-xl appearance-none transition-all duration-200 focus:outline-none focus:border-[#1B1EA9] focus:ring-4 focus:ring-[#1B1EA9]/10 hover:border-gray-300"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && filteredPeers.length > 0 && (
        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="py-2">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
              Suggestions
            </div>
            {filteredPeers.map((peer, index) => (
              <button
                key={index}
                onClick={() => handleSelect(peer)}
                className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-[#1B1EA9]/5 hover:to-[#FF2DAF]/5 focus:bg-gradient-to-r focus:from-[#1B1EA9]/5 focus:to-[#FF2DAF]/5 focus:outline-none transition-all duration-200 border-t border-gray-100"
              >
                <PeerNameDisplay 
                  peerID={peer} 
                  showBoth={true}
                  className="text-sm font-medium text-gray-800"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Info card when peer is selected */}
      {value && (
        <div className="mt-2 flex items-center gap-2 p-2 bg-gradient-to-r from-[#1B1EA9]/5 to-[#FF2DAF]/5 rounded-lg">
          <svg className="w-4 h-4 text-[#1B1EA9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="text-xs text-gray-700">Filtering by: <span className="font-semibold">{value.slice(0, 12)}...</span></span>
        </div>
      )}
    </div>
  );
};