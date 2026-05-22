import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Network, NodeStatus, Message } from '../types/Message';
import { ApiService } from '../services/api';
import { nodeStatusStore, NodeStatusWithScore } from '../services/nodeStatusStore';
import { MessageParser } from '../utils/messageParser';
import { useWebSocket } from '../hooks/useWebSocket';
import { PeerNameEditor } from './PeerNameEditor';
import { PeerNamesService } from '../services/peerNames';

const NETWORK_STORAGE_KEY = 'teranode-selected-network';

const Networks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Get network from URL query param, then localStorage, then default to mainnet
  const getInitialNetwork = (): Network => {
    const urlNetwork = searchParams.get('network');
    if (urlNetwork && ['mainnet', 'testnet', 'teratestnet'].includes(urlNetwork)) {
      return urlNetwork as Network;
    }

    const storedNetwork = localStorage.getItem(NETWORK_STORAGE_KEY);
    if (storedNetwork && ['mainnet', 'testnet', 'teratestnet'].includes(storedNetwork)) {
      return storedNetwork as Network;
    }

    return 'mainnet';
  };

  const [selectedNetwork, setSelectedNetwork] = useState<Network>(getInitialNetwork());
  const [nodeStatuses, setNodeStatuses] = useState<NodeStatusWithScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof NodeStatusWithScore>('chainworkScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set());

  // Handle network change
  const handleNetworkChange = useCallback((network: Network) => {
    setSelectedNetwork(network);
    // Update URL query parameter
    setSearchParams({ network });
    // Store in localStorage
    localStorage.setItem(NETWORK_STORAGE_KEY, network);
  }, [setSearchParams]);

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    const urlNetwork = searchParams.get('network');
    if (urlNetwork && ['mainnet', 'testnet', 'teratestnet'].includes(urlNetwork)) {
      const network = urlNetwork as Network;
      setSelectedNetwork(network);
      localStorage.setItem(NETWORK_STORAGE_KEY, network);
    }
  }, [searchParams]);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: Message) => {
    // Check if it's a node_status message
    if (message.Topic && message.Topic.includes('node_status')) {
      const parsedMessage = MessageParser.parseWebSocketMessage(message);
      if (parsedMessage && 'FSMState' in parsedMessage) {
        const nodeStatus = parsedMessage as NodeStatus;
        // Extract network from topic (format: teranode/bitcoin/1.0.0/{network}-node_status)
        const topicParts = message.Topic.split('/');
        if (topicParts.length >= 4) {
          const networkPart = topicParts[3].split('-')[0];
          // Update the parsed message with the correct network
          nodeStatus.Network = networkPart as Network;
          // Update the store which will trigger re-render if it's for the current network
          nodeStatusStore.updateNodeStatus(nodeStatus);

          // Add visual feedback for updated rows
          if (nodeStatus.Network === selectedNetwork) {
            setRecentlyUpdated(prev => new Set(prev).add(nodeStatus.PeerID));
            // Remove the highlight after 2 seconds
            setTimeout(() => {
              setRecentlyUpdated(prev => {
                const newSet = new Set(prev);
                newSet.delete(nodeStatus.PeerID);
                return newSet;
              });
            }, 2000);
          }
        }
      }
    }
  }, [selectedNetwork]);

  const { status: wsStatus, reconnect } = useWebSocket(handleWebSocketMessage);

  // Load initial data
  const loadNodeStatuses = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const statuses = await ApiService.getLatestNodeStatuses(selectedNetwork);
      nodeStatusStore.setNodeStatuses(selectedNetwork, statuses);
    } catch (err) {
      console.error('Error loading node statuses:', err);
      setError('Failed to load node statuses');
    } finally {
      setIsLoading(false);
    }
  }, [selectedNetwork]);

  // Subscribe to store changes
  useEffect(() => {
    const unsubscribe = nodeStatusStore.subscribe((network, statuses) => {
      if (network === selectedNetwork) {
        setNodeStatuses(statuses);
      }
    });

    // Also get current data from store
    const currentStatuses = nodeStatusStore.getNodeStatuses(selectedNetwork);
    setNodeStatuses(currentStatuses);

    return unsubscribe;
  }, [selectedNetwork]);

  // Load data when network changes
  useEffect(() => {
    loadNodeStatuses();
  }, [selectedNetwork, loadNodeStatuses]);

  // Refresh data periodically
  useEffect(() => {
    const interval = setInterval(() => {
      loadNodeStatuses();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [loadNodeStatuses]);

  // Track sort order separately from data
  const [sortOrder, setSortOrder] = useState<string[]>([]);

  // Filter and sort data
  const filteredAndSortedStatuses = useMemo(() => {
    let filtered = nodeStatuses;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = nodeStatuses.filter(status => {
        const friendlyName = PeerNamesService.getName(status.PeerID);
        return (
          status.ClientName?.toLowerCase().includes(search) ||
          status.PeerID.toLowerCase().includes(search) ||
          status.Version?.toLowerCase().includes(search) ||
          (friendlyName && friendlyName.toLowerCase().includes(search))
        );
      });
    }

    // If we have a sort order, use it to maintain stable positions
    if (sortOrder.length > 0 && !searchTerm) {
      const statusMap = new Map(filtered.map(s => [s.PeerID, s]));
      const sorted: NodeStatusWithScore[] = [];

      // Add items in the established order
      sortOrder.forEach(peerId => {
        const status = statusMap.get(peerId);
        if (status) {
          sorted.push(status);
          statusMap.delete(peerId);
        }
      });

      // Add any new items at the end
      statusMap.forEach(status => {
        sorted.push(status);
      });

      return sorted;
    }

    // Apply sorting when order changes or no existing order
    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      } else if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [nodeStatuses, searchTerm, sortField, sortDirection, sortOrder]);

  // Update sort order when explicitly sorting or searching
  useEffect(() => {
    if (searchTerm || sortOrder.length === 0) {
      setSortOrder(filteredAndSortedStatuses.map(s => s.PeerID));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection, searchTerm, selectedNetwork]);

  // Handle column sort
  const handleSort = (field: keyof NodeStatusWithScore) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setSortOrder([]); // Clear to force re-sort
  };

  // Format functions
  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const getFSMStateIcon = (state: string): { icon: string; color: string } => {
    switch (state?.toUpperCase()) {
      case 'RUNNING': return { icon: '✅', color: 'text-green-600' };
      case 'CATCHINGBLOCKS': return { icon: '🟠', color: 'text-orange-600' };
      case 'LEGACYSYNC': return { icon: '🟡', color: 'text-yellow-600' };
      case 'IDLE': return { icon: '⏸️', color: 'text-gray-600' };
      default: return { icon: '❓', color: 'text-gray-400' };
    }
  };

  const getNetworkColor = (network: Network): string => {
    switch (network) {
      case 'mainnet': return 'from-orange-400 to-orange-600';
      case 'testnet': return 'from-green-400 to-green-600';
      case 'teratestnet': return 'from-indigo-400 to-indigo-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

  const formatMinFee = (fee?: number | null): string => {
    if (fee === undefined || fee === null) return '0 sat/kB';
    if (fee === 0) return '0 sat/kB';

    // Convert from BSV/byte to satoshis per kilobyte
    const satPerByte = fee * 100000000;
    const satPerKB = satPerByte * 1000;

    if (satPerKB < 1) {
      return `${satPerKB.toFixed(2)} sat/kB`;
    }
    return `${Math.floor(satPerKB)} sat/kB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Network Status</h1>
              <p className="text-gray-600">
                Real-time node status monitoring •
                <span className="font-semibold text-gray-900"> {filteredAndSortedStatuses.length}</span> nodes
                {wsStatus === 'connected' && <span className="ml-2 text-green-600">● Live</span>}
              </p>
            </div>

            {/* Network Selector */}
            <div className="flex items-center gap-4">
              <select
                value={selectedNetwork}
                onChange={(e) => handleNetworkChange(e.target.value as Network)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mainnet">Mainnet</option>
                <option value="testnet">Testnet</option>
                <option value="teratestnet">Teratestnet</option>
              </select>

              <button
                onClick={loadNodeStatuses}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by client name, peer ID, or version..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 pl-12 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className={`bg-gradient-to-r ${getNetworkColor(selectedNetwork)} text-white`}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    State
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('ClientName')}
                  >
                    Client {sortField === 'ClientName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('Version')}
                  >
                    Version {sortField === 'Version' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('BestHeight')}
                  >
                    Height {sortField === 'BestHeight' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Best Block Hash
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('chainworkScore')}
                  >
                    Chain Score {sortField === 'chainworkScore' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider">
                    Min Fee
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('Uptime')}
                  >
                    Uptime {sortField === 'Uptime' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Listen Mode
                  </th>
                  <th
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-white/10"
                    onClick={() => handleSort('ReceivedAt')}
                  >
                    Last Update {sortField === 'ReceivedAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {isLoading && filteredAndSortedStatuses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      <div className="inline-flex items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                        Loading node statuses...
                      </div>
                    </td>
                  </tr>
                ) : filteredAndSortedStatuses.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      No nodes found {searchTerm && `matching "${searchTerm}"`}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedStatuses.map((status) => {
                    const fsmState = getFSMStateIcon(status.FSMState);
                    const isTopChainwork = status.chainworkScore === status.maxChainworkScore && status.chainworkScore! > 0;
                    const friendlyName = PeerNamesService.getName(status.PeerID);
                    const isRecentlyUpdated = recentlyUpdated.has(status.PeerID);

                    return (
                      <tr
                        key={status.PeerID}
                        className={`hover:bg-gray-50 transition-all duration-500 ${
                          isRecentlyUpdated ? 'bg-green-50 animate-pulse' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xl ${fsmState.color}`} title={status.FSMState}>
                            {fsmState.icon}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">
                                {status.ClientName || 'Unknown'}
                              </span>
                              <PeerNameEditor peerID={status.PeerID} />
                            </div>
                            {friendlyName && (
                              <div className="text-xs text-blue-600 font-medium">{friendlyName}</div>
                            )}
                            <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]" title={status.PeerID}>
                              {status.PeerID}
                            </div>
                            {status.BaseURL && (
                              <div className="text-xs text-gray-400 truncate max-w-[200px]" title={status.BaseURL}>
                                {status.BaseURL}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm text-gray-900">{status.Version || '-'}</div>
                            {status.CommitHash && (
                              <div className="text-xs text-gray-500 font-mono">
                                {status.CommitHash.substring(0, 8)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm font-medium text-gray-900">
                            {status.BestHeight?.toLocaleString() || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-700 truncate max-w-[150px]" title={status.BestBlockHash}>
                              {status.BestBlockHash?.substring(0, 16)}...
                            </span>
                            {status.MinerName && (
                              <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-700">
                                {status.MinerName}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {status.chainworkScore !== undefined && status.chainworkScore > 0 ? (
                            <span className={`text-sm font-medium px-2 py-1 rounded ${
                              isTopChainwork ? 'bg-green-100 text-green-800' : 'text-gray-600'
                            }`}>
                              {status.chainworkScore}
                              {isTopChainwork && ' 👑'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-900">
                            {formatMinFee(status.MinMiningTxFee)}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-900">{formatUptime(status.Uptime)}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-sm px-2 py-1 rounded ${
                            status.ListenMode === 'full'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {status.ListenMode || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span className="text-sm text-gray-500">
                            {formatTime(status.ReceivedAt)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        {!isLoading && filteredAndSortedStatuses.length > 0 && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Total Nodes</div>
              <div className="text-2xl font-bold text-gray-900">{filteredAndSortedStatuses.length}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Running Nodes</div>
              <div className="text-2xl font-bold text-green-600">
                {filteredAndSortedStatuses.filter(s => s.FSMState === 'RUNNING').length}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Max Height</div>
              <div className="text-2xl font-bold text-blue-600">
                {Math.max(...filteredAndSortedStatuses.map(s => s.BestHeight || 0)).toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-sm text-gray-600">Full Listen Mode</div>
              <div className="text-2xl font-bold text-purple-600">
                {filteredAndSortedStatuses.filter(s => s.ListenMode === 'full').length}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Networks;