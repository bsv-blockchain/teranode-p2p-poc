import React, { useState, useEffect } from 'react';

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
      const filtered = recentPeers.filter(peer => 
        peer.toLowerCase().includes(value.toLowerCase())
      );
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
      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Peer ID</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="block w-full px-3 sm:px-4 py-3 pr-10 text-sm sm:text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg min-h-[44px]"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && filteredPeers.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="py-1">
            {filteredPeers.map((peer, index) => (
              <button
                key={index}
                onClick={() => handleSelect(peer)}
                className="w-full px-3 sm:px-4 py-2 text-left text-xs sm:text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              >
                <div className="font-mono text-xs truncate">{peer}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      <p className="mt-1 text-xs sm:text-sm text-gray-500">
        Enter a peer ID to filter messages
      </p>
    </div>
  );
};