import React, { useEffect, useState } from 'react';
import { MessageStats } from '../types/Message';
import { ApiService } from '../services/api';

const Stats: React.FC = () => {
  const [stats, setStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const statsData = await ApiService.getMessageStats();
        setStats(statsData);
      } catch (err) {
        setError('Failed to load statistics');
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
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
    
    return date.toLocaleDateString();
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
      case 'mining_on': return '⛏️';
      case 'subtree': return '🌳';
      case 'handshake': return '🤝';
      case 'rejected_tx': return '❌';
      case 'bestblock': return '🏆';
      default: return '📦';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-lg w-48 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-lg">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <p className="text-red-600 text-center">{error || 'No statistics available'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate additional statistics
  const avgMessagesPerPeer = stats.uniquePeers > 0 
    ? Math.round(stats.totalMessages / stats.uniquePeers) 
    : 0;
  
  const messagesPerHour = stats.messagesToday > 0 
    ? Math.round(stats.messagesToday / 24) 
    : 0;

  const mostActiveNetwork = stats.topicStats.reduce((acc, topic) => {
    if (topic.network) {
      acc[topic.network] = (acc[topic.network] || 0) + topic.messageCount;
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedNetworks = Object.entries(mostActiveNetwork)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Network Statistics</h1>
          <p className="text-gray-600">Real-time insights into the Bitcoin SV P2P network</p>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <span className="text-blue-100">Total Messages</span>
              <span className="text-3xl">📨</span>
            </div>
            <div className="text-3xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <div className="text-sm text-blue-100 mt-2">All time</div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <span className="text-green-100">Active Peers</span>
              <span className="text-3xl">🌐</span>
            </div>
            <div className="text-3xl font-bold">{stats.uniquePeers.toLocaleString()}</div>
            <div className="text-sm text-green-100 mt-2">{avgMessagesPerPeer} avg msgs/peer</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <span className="text-purple-100">Messages Today</span>
              <span className="text-3xl">📅</span>
            </div>
            <div className="text-3xl font-bold">{stats.messagesToday.toLocaleString()}</div>
            <div className="text-sm text-purple-100 mt-2">~{messagesPerHour}/hour</div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-xl transform hover:scale-105 transition-transform">
            <div className="flex items-center justify-between mb-4">
              <span className="text-orange-100">Unique Topics</span>
              <span className="text-3xl">🏷️</span>
            </div>
            <div className="text-3xl font-bold">{stats.uniqueTopics}</div>
            <div className="text-sm text-orange-100 mt-2">Active channels</div>
          </div>
        </div>

        {/* Network Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Network Activity</h2>
            <div className="space-y-4">
              {sortedNetworks.map(([network, count]) => {
                const percentage = (count / stats.totalMessages) * 100;
                return (
                  <div key={network}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700 capitalize">{network}</span>
                      <span className="text-sm text-gray-600">{count.toLocaleString()} messages</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`bg-gradient-to-r ${getNetworkColor(network)} h-3 rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Latest Block Heights */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Latest Block Heights</h2>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(stats.latestBlockHeight).map(([network, height]) => (
                <div key={network} className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm font-medium text-gray-600 uppercase mb-1">{network}</div>
                  <div className="text-2xl font-bold text-gray-900">{height.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Messages by Topic */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Messages by Topic</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Network</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Message Type</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Count</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-600">Percentage</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.topicStats.map((topic, index) => {
                  const percentage = ((topic.messageCount / stats.totalMessages) * 100).toFixed(2);
                  return (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getNetworkColor(topic.network || '')} text-white`}>
                          {topic.network || 'unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <span className="text-xl mr-2">{getMessageTypeIcon(topic.messageType || '')}</span>
                          <span className="text-sm font-medium text-gray-900">{topic.messageType || topic.topic}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {topic.messageCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {percentage}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-gradient-to-r ${getNetworkColor(topic.network || '')} h-2 rounded-full`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Active Peers */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Top Active Peers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.topPeers.map((peer, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                  <span className="text-sm text-gray-500">{formatTime(peer.lastSeen)}</span>
                </div>
                <div className="font-mono text-xs text-gray-700 mb-2 break-all">
                  {peer.peerID}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Messages</span>
                  <span className="text-lg font-bold text-gray-900">{peer.messageCount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Last Update */}
        {stats.lastMessageTime && (
          <div className="text-center text-sm text-gray-600 pb-8">
            Last message received: {formatTime(stats.lastMessageTime)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;