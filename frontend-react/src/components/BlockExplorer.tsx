import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import { BlockHeader, Network } from '../types/Message';
import { NetworkSelector } from './NetworkSelector';
import { useWebSocket } from '../hooks/useWebSocket';
import WebSocketStatusComponent from './WebSocketStatus';
import { BlockDetailsModal } from './BlockDetailsModal';

export const BlockExplorer: React.FC = () => {
  const [blockHeaders, setBlockHeaders] = useState<BlockHeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedNetwork, setSelectedNetwork] = useState<Network | 'all'>('mainnet');
  const [networks] = useState<Network[]>(['mainnet', 'testnet', 'teratestnet', 'tstn']);
  const [selectedBlock, setSelectedBlock] = useState<BlockHeader | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filter states
  const [minHeight, setMinHeight] = useState<string>('');
  const [maxHeight, setMaxHeight] = useState<string>('');
  const [searchHash, setSearchHash] = useState<string>('');
  const [sortField, setSortField] = useState<'height' | 'timestamp'>('height');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);
  const itemsPerPage = 20;
  
  // Stats
  const [stats, setStats] = useState({
    latestHeights: {} as Record<string, number>
  });

  // State for tracking if we need to refresh
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [newBlockIds, setNewBlockIds] = useState<Set<number>>(new Set());

  // WebSocket for real-time updates
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.Topic?.includes('-block')) {
      // Check if the new block matches our current filters
      const messageNetwork = message.Topic.split('/')[1]?.split('-')[0];
      if (selectedNetwork === 'all' || messageNetwork === selectedNetwork) {
        // Trigger a refresh
        setShouldRefresh(true);
      }
    }
  }, [selectedNetwork]);

  const { status: wsStatus, reconnect } = useWebSocket(handleWebSocketMessage);

  useEffect(() => {
    fetchBlockHeaders();
    updateStats();
  }, [selectedNetwork, minHeight, maxHeight, searchHash, sortField, sortDirection, currentPage]);

  // Handle WebSocket refresh trigger
  useEffect(() => {
    if (shouldRefresh) {
      fetchBlockHeaders();
      updateStats();
      setShouldRefresh(false);
    }
  }, [shouldRefresh]);

  const fetchBlockHeaders = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = { 
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage
      };
      
      if (selectedNetwork !== 'all') params.network = selectedNetwork;
      if (minHeight) params.minHeight = parseInt(minHeight);
      if (maxHeight) params.maxHeight = parseInt(maxHeight);
      if (searchHash) params.hash = searchHash;
      
      const headers = await ApiService.getBlockHeaders(params);
      
      // Sort the results
      const sorted = [...headers].sort((a, b) => {
        const field = sortField;
        const aVal = a[field === 'height' ? 'Height' : 'Timestamp'];
        const bVal = b[field === 'height' ? 'Height' : 'Timestamp'];
        
        if (sortDirection === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
      
      // Mark new blocks if we're on the first page and this is a refresh
      if (currentPage === 1 && shouldRefresh && sorted.length > 0) {
        const latestBlockId = sorted[0].ID;
        if (blockHeaders.length > 0 && latestBlockId !== blockHeaders[0].ID) {
          setNewBlockIds(new Set([latestBlockId]));
          // Remove the highlight after 3 seconds
          setTimeout(() => {
            setNewBlockIds(prev => {
              const newSet = new Set(prev);
              newSet.delete(latestBlockId);
              return newSet;
            });
          }, 3000);
        }
      }
      
      setBlockHeaders(sorted);
      setTotalBlocks(headers.length === itemsPerPage ? (currentPage * itemsPerPage) + 1 : headers.length);
    } catch (err) {
      setError('Failed to fetch block headers');
      console.error('Error fetching block headers:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = async () => {
    try {
      const stats = await ApiService.getMessageStats();
      setStats({
        latestHeights: stats.latestBlockHeight
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const getRelativeTime = (timestamp: number) => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'mainnet': return 'bg-green-100 text-green-800';
      case 'testnet': return 'bg-blue-100 text-blue-800';
      case 'teratestnet': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleSort = (field: 'height' | 'timestamp') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const clearFilters = () => {
    setMinHeight('');
    setMaxHeight('');
    setSearchHash('');
    setSelectedNetwork('all');
    setCurrentPage(1);
  };

  const activeFilters = [
    selectedNetwork !== 'all',
    minHeight !== '',
    maxHeight !== '',
    searchHash !== ''
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#F9F9F9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="mb-10">
          <div className="bg-gradient-to-r from-[#1B1EA9] via-[#1B1EA9] to-[#FF2DAF] rounded-3xl shadow-2xl p-8 sm:p-12 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-white rounded-full blur-3xl"></div>
              <div className="absolute -bottom-8 -left-8 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
                <div className="flex-1 max-w-3xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-3">
                      <span className="text-3xl">⛓️</span>
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">Block Explorer</h1>
                      <p className="text-lg sm:text-xl text-white/90">Real-time BSV blockchain block monitoring</p>
                    </div>
                  </div>
                  
                  <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-6 max-w-3xl">
                    Monitor BSV blockchain blocks in real-time across mainnet, testnet, and teratestnet. View detailed block headers, 
                    analyze mining patterns, and explore coinbase transactions. Track block propagation and network consensus as it happens.
                  </p>
                  
                  <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-lg">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      <div className="relative w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-sm font-semibold text-white">Real-time Block Tracking</span>
                  </div>
                </div>
                
                {/* Right Side - Block Stats */}
                <div className="lg:flex-shrink-0 lg:w-96">
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                    <h3 className="text-lg font-semibold text-white/90 mb-4">Network Block Heights</h3>
                    
                    {/* Latest Heights */}
                    <div className="space-y-3">
                      {Object.entries(stats.latestHeights).map(([network, height]) => (
                        <div key={network} className="bg-white/10 rounded-xl p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-white/70 capitalize">{network}</span>
                            <span className="text-lg font-bold text-white">{height.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* WebSocket Status */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <WebSocketStatusComponent status={wsStatus} onReconnect={reconnect} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Selection */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-[#1B1EA9] to-[#FF2DAF] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Select Network</h2>
            </div>
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={setSelectedNetwork}
              networks={networks}
            />
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B1EA9]/5 via-[#FF2DAF]/5 to-[#1B1EA9]/5 rounded-3xl blur-xl"></div>
          
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] p-[2px]">
              <div className="bg-white/95 backdrop-blur px-8 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-[#FF2DAF] to-[#1B1EA9] rounded-2xl blur-lg opacity-60"></div>
                      <div className="relative w-12 h-12 bg-gradient-to-br from-[#FF2DAF] to-[#1B1EA9] rounded-2xl flex items-center justify-center shadow-lg">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] bg-clip-text text-transparent">
                        Block Filters
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">Find specific blocks or analyze patterns</p>
                    </div>
                  </div>
                  
                  {/* Active Filter Count */}
                  {activeFilters > 0 && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-[#1B1EA9]/10 to-[#FF2DAF]/10 px-4 py-2 rounded-full">
                      <span className="text-sm font-medium text-gray-700">{activeFilters} active</span>
                      <button
                        onClick={clearFilters}
                        className="ml-1 p-1 hover:bg-white/50 rounded-full transition-colors"
                      >
                        <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Filter Content */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Height Range */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Height Range</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Min"
                      value={minHeight}
                      onChange={(e) => setMinHeight(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B1EA9] focus:border-transparent"
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B1EA9] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Hash Search */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Block Hash</label>
                  <input
                    type="text"
                    placeholder="Search by hash..."
                    value={searchHash}
                    onChange={(e) => setSearchHash(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B1EA9] focus:border-transparent"
                  />
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Block Headers Table */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Block Headers</h2>
            <p className="text-sm text-gray-600 mt-1">
              {loading ? 'Loading...' : `Showing ${blockHeaders.length} blocks`}
            </p>
          </div>

          {error && (
            <div className="px-8 py-4 bg-red-50 border-b border-red-200">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && blockHeaders.length === 0 ? (
            <div className="px-8 py-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No blocks found</h3>
              <p className="text-gray-600">Try adjusting your filters or wait for new blocks to arrive.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Network
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('height')}
                    >
                      <div className="flex items-center gap-1">
                        Height
                        {sortField === 'height' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hash
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('timestamp')}
                    >
                      <div className="flex items-center gap-1">
                        Timestamp
                        {sortField === 'timestamp' && (
                          <svg className={`w-4 h-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nonce
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blockHeaders.map((header) => (
                    <tr 
                      key={header.ID} 
                      className={`hover:bg-gray-50 transition-colors ${
                        newBlockIds.has(header.ID) ? 'bg-green-50 animate-pulse' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNetworkColor(header.Network)}`}>
                          {header.Network}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          {header.Height.toLocaleString()}
                          {newBlockIds.has(header.ID) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              New
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 font-mono truncate max-w-xs" title={header.Hash}>
                            {header.Hash.substring(0, 16)}...
                          </span>
                          <button
                            onClick={() => navigator.clipboard.writeText(header.Hash)}
                            className="text-gray-400 hover:text-gray-600"
                            title="Copy full hash"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>
                          <div>{formatTimestamp(header.Timestamp)}</div>
                          <div className="text-xs text-gray-400">{getRelativeTime(header.Timestamp)}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {header.Nonce.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button 
                          onClick={() => {
                            setSelectedBlock(header);
                            setIsModalOpen(true);
                          }}
                          className="text-[#1B1EA9] hover:text-[#FF2DAF] font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && blockHeaders.length > 0 && (
            <div className="px-8 py-4 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {currentPage}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={blockHeaders.length < itemsPerPage}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Block Details Modal */}
      <BlockDetailsModal
        blockHeader={selectedBlock}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBlock(null);
        }}
      />
    </div>
  );
};