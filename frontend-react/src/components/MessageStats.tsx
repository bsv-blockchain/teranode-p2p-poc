import React, { useEffect, useState } from 'react';
import { MessageStats } from '../types/Message';
import { ApiService } from '../services/api';

interface MessageStatsProps {
  className?: string;
}

const MessageStatsComponent: React.FC<MessageStatsProps> = ({ className = '' }) => {
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

  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-1"></div>
              <div className="h-3 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-red-500 text-sm">{error || 'No statistics available'}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Messages',
      value: stats.totalMessages.toLocaleString(),
      icon: '📨',
      color: 'blue',
      subtitle: 'Total messages of all time since July 23, 2025'
    },
    {
      title: 'Unique Topics',
      value: stats.uniqueTopics.toString(),
      icon: '🏷️',
      color: 'green',
      subtitle: 'Active topics'
    },
    {
      title: 'Connected Peers',
      value: stats.uniquePeers.toString(),
      icon: '🌐',
      color: 'purple',
      subtitle: 'Network nodes'
    },
    {
      title: 'Messages Today',
      value: stats.messagesToday.toLocaleString(),
      icon: '📅',
      color: 'orange',
      subtitle: 'Last 24 hours'
    }
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'green': return 'bg-green-50 border-green-200 text-green-700';
      case 'purple': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'orange': return 'bg-orange-50 border-orange-200 text-orange-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`relative overflow-hidden rounded-xl border-2 p-4 sm:p-6 transition-all duration-300 hover:shadow-md hover:scale-105 ${getColorClasses(card.color)}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="text-xs sm:text-sm font-medium opacity-75 mb-1">
                  {card.title}
                </div>
                <div className="text-xl sm:text-2xl font-bold mb-1">
                  {card.value}
                </div>
                <div className="text-xs opacity-60">
                  {card.subtitle}
                </div>
              </div>
              <div className="text-xl sm:text-2xl opacity-75">
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Latest Block Heights */}
      {stats.latestBlockHeight && Object.keys(stats.latestBlockHeight).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Latest Block Heights</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {Object.entries(stats.latestBlockHeight).map(([network, height]) => (
              <div key={network} className="text-center">
                <div className="text-xs sm:text-sm font-medium text-gray-500 uppercase mb-1">
                  {network}
                </div>
                <div className="text-lg sm:text-xl font-bold text-gray-900">
                  {height.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic Statistics */}
      {stats.topicStats && stats.topicStats.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Messages by Topic</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Network
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message Type
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.topicStats.map((topic, index) => {
                  const percentage = ((topic.messageCount / stats.totalMessages) * 100).toFixed(2);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          topic.network === 'mainnet' ? 'bg-green-100 text-green-800' :
                          topic.network === 'testnet' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {topic.network || 'unknown'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                        {topic.messageType || topic.topic}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {topic.messageCount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-600 text-right">
                        {percentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.lastMessageTime && (
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Last message received: {formatTime(stats.lastMessageTime)}
          </p>
        </div>
      )}
    </div>
  );
};

export default MessageStatsComponent;