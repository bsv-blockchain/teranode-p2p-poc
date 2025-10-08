import React, { useState, useEffect } from 'react';
import { PeerStat, PeersResponse } from '../types/Message';
import { ApiService } from '../services/api';
import { Link } from 'react-router-dom';
import { PeerNameEditor } from './PeerNameEditor';
import { PeerNamesService } from '../services/peerNames';

const Peers: React.FC = () => {
  const [peers, setPeers] = useState<PeerStat[]>([]);
  const [totalPeers, setTotalPeers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const peersPerPage = 12;

  useEffect(() => {
    fetchPeers();
  }, [currentPage]);

  const fetchPeers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response: PeersResponse = await ApiService.getPeers(currentPage, peersPerPage);
      setPeers(response.peers);
      setTotalPeers(response.totalPeers);
    } catch (err) {
      setError('Failed to load peers');
      console.error('Error fetching peers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeSince = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes === 0) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'mainnet': return 'from-green-400 to-green-600';
      case 'testnet': return 'from-blue-400 to-blue-600';
      case 'regtest': return 'from-purple-400 to-purple-600';
      case 'stn': return 'from-orange-400 to-orange-600';
      case 'teratestnet': return 'from-pink-400 to-pink-600';
      case 'tstn': return 'from-indigo-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'block': return '🔲';
      // case 'miningon': return '⛏️'; // Temporarily disabled
      case 'subtree': return '🌳';
      case 'handshake': return '🤝';
      case 'rejected_tx': return '❌';
      case 'node_status': return '🖥️';
      case 'bestblock': return '🏆';
      default: return '📦';
    }
  };

  const getActivityLevel = (messageCount: number) => {
    if (messageCount > 10000) return { level: 'Very High', color: 'from-red-500 to-orange-500' };
    if (messageCount > 5000) return { level: 'High', color: 'from-orange-500 to-yellow-500' };
    if (messageCount > 1000) return { level: 'Medium', color: 'from-yellow-500 to-green-500' };
    return { level: 'Low', color: 'from-green-500 to-blue-500' };
  };

  // Filter peers based on search term (including friendly names)
  const filteredPeers = peers.filter(peer => {
    const searchLower = searchTerm.toLowerCase();
    const friendlyName = PeerNamesService.getName(peer.peerID);
    
    return peer.peerID.toLowerCase().includes(searchLower) ||
           (friendlyName && friendlyName.toLowerCase().includes(searchLower)) ||
           peer.lastUserAgent?.toLowerCase().includes(searchLower) ||
           peer.networks.some(network => network.toLowerCase().includes(searchLower));
  });

  const totalPages = Math.ceil(totalPeers / peersPerPage);

  if (isLoading && peers.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-lg w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-lg h-64"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-600 text-center">{error}</p>
            <button 
              onClick={fetchPeers}
              className="mt-4 mx-auto block px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Network Peers</h1>
              <p className="text-gray-600">
                Monitoring <span className="font-semibold text-gray-900">{totalPeers}</span> active peers
              </p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2 mt-4 sm:mt-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by peer ID, user agent, or network..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Peers Display */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {filteredPeers.map((peer) => {
              const activity = getActivityLevel(peer.totalMessages);
              return (
                <div key={peer.peerID} className="bg-white rounded-2xl shadow-lg overflow-hidden transform hover:scale-105 transition-all duration-300">
                  {/* Activity Level Header */}
                  <div className={`h-2 bg-gradient-to-r ${activity.color}`} />
                  
                  <div className="p-6">
                    {/* Peer ID and Name Editor */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-1">Peer ID</p>
                      <PeerNameEditor 
                        peerID={peer.peerID} 
                        className="mb-2"
                        showFullPeerID={false}
                      />
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
                        <p className="text-xs text-blue-600 mb-1">Messages</p>
                        <p className="text-xl font-bold text-blue-900">{peer.totalMessages.toLocaleString()}</p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
                        <p className="text-xs text-green-600 mb-1">Activity</p>
                        <p className="text-sm font-semibold text-green-900">{activity.level}</p>
                      </div>
                    </div>

                    {/* Networks */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Networks</p>
                      <div className="flex flex-wrap gap-1">
                        {peer.networks.map((network) => (
                          <span
                            key={network}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getNetworkColor(network)} text-white`}
                          >
                            {network}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Message Types */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Message Types</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(peer.messageTypes).slice(0, 3).map(([type, count]) => (
                          <div key={type} className="flex items-center space-x-1">
                            <span className="text-sm">{getMessageTypeIcon(type)}</span>
                            <span className="text-xs text-gray-600">{count.toLocaleString()}</span>
                          </div>
                        ))}
                        {Object.keys(peer.messageTypes).length > 3 && (
                          <span className="text-xs text-gray-400">+{Object.keys(peer.messageTypes).length - 3}</span>
                        )}
                      </div>
                    </div>

                    {/* Last Seen */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Last Seen</p>
                        <p className="text-sm font-medium text-gray-900">{getTimeSince(peer.lastSeen)}</p>
                      </div>
                      {peer.lastBestHeight && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Best Height</p>
                          <p className="text-sm font-medium text-gray-900">{peer.lastBestHeight.toLocaleString()}</p>
                        </div>
                      )}
                    </div>

                    {/* User Agent */}
                    {peer.lastUserAgent && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-1">User Agent</p>
                        <p className="text-xs text-gray-600 truncate" title={peer.lastUserAgent}>
                          {peer.lastUserAgent}
                        </p>
                      </div>
                    )}

                    {/* View Details Button */}
                    <Link
                      to={`/peers/${peer.peerID}`}
                      className="block w-full text-center py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Peer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Messages</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Networks</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Activity</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Seen</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredPeers.map((peer) => {
                    const activity = getActivityLevel(peer.totalMessages);
                    return (
                      <tr key={peer.peerID} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <PeerNameEditor 
                              peerID={peer.peerID} 
                              className="mb-1"
                              showFullPeerID={false}
                            />
                            {peer.lastUserAgent && (
                              <p className="text-xs text-gray-500 truncate max-w-xs" title={peer.lastUserAgent}>
                                {peer.lastUserAgent}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <span className="text-lg font-bold text-gray-900">{peer.totalMessages.toLocaleString()}</span>
                            <div className={`ml-3 w-2 h-8 bg-gradient-to-t ${activity.color} rounded-full`} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {peer.networks.map((network) => (
                              <span
                                key={network}
                                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getNetworkColor(network)} text-white`}
                              >
                                {network}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${activity.color} text-white`}>
                            {activity.level}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{getTimeSince(peer.lastSeen)}</p>
                            <p className="text-xs text-gray-500">{formatTime(peer.lastSeen)}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Link
                            to={`/peers/${peer.peerID}`}
                            className="inline-flex items-center px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white rounded-xl shadow-sm px-6 py-4">
            <div className="text-sm text-gray-700 mb-4 sm:mb-0">
              Showing{' '}
              <span className="font-semibold">
                {(currentPage - 1) * peersPerPage + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold">
                {Math.min(currentPage * peersPerPage, totalPeers)}
              </span>{' '}
              of{' '}
              <span className="font-semibold">{totalPeers}</span> peers
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              
              <div className="flex space-x-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-all ${
                        currentPage === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Peers;