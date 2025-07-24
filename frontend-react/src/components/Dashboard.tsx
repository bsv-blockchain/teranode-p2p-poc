import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import { MessageAggregatorService } from '../services/messageAggregator';
import { MessageParser } from '../utils/messageParser';
import { useWebSocket } from '../hooks/useWebSocket';
import { NetworkSelector } from './NetworkSelector';
import { MessageTypeFilter } from './MessageTypeFilter';
import { PeerFilter } from './PeerFilter';
import PaginationComponent from './Pagination';
import WebSocketStatusComponent from './WebSocketStatus';
import { 
  BlockCard, 
  MiningCard, 
  SubtreeCard, 
  HandshakeCard, 
  RejectedTxCard
} from './MessageCards';
import { 
  Network, 
  MessageType, 
  DashboardFilters,
  Block,
  MiningOn,
  Subtree,
  Handshake,
  RejectedTx,
  Message,
  PaginationInfo
} from '../types/Message';

export const Dashboard: React.FC = () => {
  const [selectedNetwork, setSelectedNetwork] = useState<Network | 'all'>('all');
  const [selectedMessageType, setSelectedMessageType] = useState<MessageType | 'all'>('all');
  const [peerFilter, setPeerFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [messageTypes, setMessageTypes] = useState<MessageType[]>([]);
  const [recentPeers, setRecentPeers] = useState<string[]>([]);
  const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState({ totalMessages: 0, uniquePeers: 0 });

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: Message) => {
    // Only add to current view if we're on the first page
    if (currentPage === 1) {
      // Parse the message to get structured data
      const parsedMessage = MessageParser.parseWebSocketMessage(message);
      
      // Check if message matches current filters
      const messageNetwork = message.Topic.split('/')[1]?.split('-')[0];
      const messageType = message.Topic.split('-')[1];
      
      
      const matchesNetwork = selectedNetwork === 'all' || messageNetwork === selectedNetwork;
      const matchesType = selectedMessageType === 'all' || messageType === selectedMessageType;
      
      // Check peer filter - filter by the parsed PeerID, not sentFromPeer
      const matchesPeer = !peerFilter || parsedMessage.PeerID === peerFilter;
      
      if (matchesNetwork && matchesType && matchesPeer) {
        setData(prev => [parsedMessage, ...prev.slice(0, 19)]);
        setNewMessageIds(prev => new Set(prev).add(parsedMessage.ID));
        
        // Remove the "new" indicator after 3 seconds
        setTimeout(() => {
          setNewMessageIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(parsedMessage.ID);
            return newSet;
          });
        }, 3000);
      }
    }
  }, [currentPage, peerFilter, selectedNetwork, selectedMessageType]);

  const { status: wsStatus, reconnect } = useWebSocket(handleWebSocketMessage);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [networksData, messageTypesData, statsData] = await Promise.all([
          ApiService.getNetworks(),
          ApiService.getMessageTypes(),
          ApiService.getMessageStats()
        ]);
        setNetworks(networksData);
        setMessageTypes(messageTypesData);
        setStats({ 
          totalMessages: statsData.totalMessages || 0, 
          uniquePeers: statsData.uniquePeers || 0 
        });
      } catch (error) {
        console.error('Error loading initial data:', error);
        setError('Failed to load initial data');
      }
    };
    loadInitialData();
  }, []);

  // Load messages based on filters
  useEffect(() => {
    const loadMessages = async () => {
      setLoading(true);
      setError('');
      try {
        const filters: DashboardFilters = {
          network: selectedNetwork,
          messageType: selectedMessageType,
          peer: peerFilter || undefined,
          limit: 20,
          page: currentPage
        };

        // Use aggregator when viewing all messages
        const result = selectedMessageType === 'all' 
          ? await MessageAggregatorService.getAllMessages(filters)
          : await ApiService.getMessagesByType(filters);
        
        setData(result.data);
        setPagination(result.pagination);
        
        // Extract peer IDs for autocomplete
        const peers = result.data
          .map((item: any) => item.PeerID || item.Peer)
          .filter(Boolean)
          .slice(0, 10);
        setRecentPeers(Array.from(new Set(peers)));
        
      } catch (error) {
        console.error('Error loading messages:', error);
        setError('Failed to load messages: ' + (error as Error).message);
        setData([]);
        setPagination(null);
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [selectedNetwork, selectedMessageType, peerFilter, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedNetwork, selectedMessageType, peerFilter]);

  const renderMessageCard = (item: any, index: number) => {
    const isNew = newMessageIds.has(item.ID);
    
    // When viewing all messages, detect the message type
    let messageType = selectedMessageType;
    if (selectedMessageType === 'all') {
      // First check if we have the type from the aggregator
      if (item._messageType) {
        messageType = item._messageType as MessageType;
      } else if (item.Topic) {
        // Fallback to extracting from topic (for WebSocket messages)
        const topicParts = item.Topic.split('-');
        if (topicParts.length > 1) {
          messageType = topicParts[topicParts.length - 1] as MessageType;
        }
      }
    }
    
    
    switch (messageType) {
      case 'block':
        return <BlockCard key={item.ID || index} block={item as Block} isNew={isNew} />;
      case 'miningon':
        return <MiningCard key={item.ID || index} mining={item as MiningOn} isNew={isNew} />;
      case 'subtree':
        return <SubtreeCard key={item.ID || index} subtree={item as Subtree} isNew={isNew} />;
      case 'handshake':
        return <HandshakeCard key={item.ID || index} handshake={item as Handshake} isNew={isNew} />;
      case 'rejected_tx':
        return <RejectedTxCard key={item.ID || index} rejectedTx={item as RejectedTx} isNew={isNew} />;
      default:
        // Should not reach here - log error and return null
        console.error('Unknown message type:', messageType, 'for item:', item);
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="mb-10">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl shadow-2xl p-8 sm:p-12 text-white relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-white rounded-full blur-3xl"></div>
              <div className="absolute -bottom-8 -left-8 w-96 h-96 bg-white rounded-full blur-3xl"></div>
            </div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">Teranode P2P Monitor</h1>
                      <p className="text-lg sm:text-xl text-blue-100">Real-time Bitcoin SV Network Intelligence</p>
                    </div>
                  </div>
                  
                  <p className="text-base sm:text-lg text-blue-50 leading-relaxed mb-6 max-w-3xl">
                    Welcome to the Teranode P2P Monitor, your window into the Bitcoin SV network's peer-to-peer communication layer. 
                    This platform provides real-time visibility into network messages, peer interactions, and blockchain activity across 
                    multiple BSV networks. Monitor block propagation, transaction flows, and network health metrics as they happen, 
                    giving developers and operators unprecedented insight into the Teranode infrastructure.
                  </p>
                  
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium">Live Monitoring</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      <span className="text-sm font-medium">{stats.totalMessages.toLocaleString()} Messages</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur px-4 py-2 rounded-full">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span className="text-sm font-medium">{stats.uniquePeers} Active Peers</span>
                    </div>
                  </div>
                </div>
                
                {/* WebSocket Status */}
                <div className="lg:absolute lg:top-8 lg:right-8">
                  <WebSocketStatusComponent status={wsStatus} onReconnect={reconnect} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network Selection - Elevated Design */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
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


        {/* Secondary Filters */}
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Filter Messages</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MessageTypeFilter
              selectedType={selectedMessageType}
              onTypeChange={setSelectedMessageType}
              messageTypes={messageTypes}
            />
            <PeerFilter
              value={peerFilter}
              onChange={setPeerFilter}
              recentPeers={recentPeers}
            />
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 bg-red-50/80 backdrop-blur-xl border border-red-200 rounded-2xl p-6 shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <svg className="h-6 w-6 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-base font-semibold text-red-900">Error occurred</h3>
                <div className="mt-1 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Section */}
        <div className="space-y-8">
          {/* Results Header */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 px-8 py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedNetwork !== 'all' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500 to-indigo-600 text-white mr-2">
                      {selectedNetwork.toUpperCase()}
                    </span>
                  )}
                  {selectedMessageType === 'all' ? 'All Messages' : 
                   selectedMessageType.split('_').map(word => 
                     word.charAt(0).toUpperCase() + word.slice(1)
                   ).join(' ')
                  }
                </h2>
                {pagination && (
                  <p className="text-gray-600">
                    Showing <span className="font-semibold text-gray-900">{data.length}</span> of{' '}
                    <span className="font-semibold text-gray-900">{pagination.totalItems.toLocaleString()}</span> messages
                  </p>
                )}
              </div>
              
              {loading && (
                <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-full">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-sm font-medium text-blue-700">Updating...</span>
                </div>
              )}
            </div>
          </div>

          {/* Messages Grid */}
          {data.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.map((item, index) => (
                <div key={item.ID || index} className="transform transition-all duration-300 hover:scale-[1.02]">
                  {renderMessageCard(item, index)}
                </div>
              ))}
            </div>
          ) : loading ? (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
              </div>
              <p className="text-lg font-medium text-gray-700">Loading messages...</p>
              <p className="text-sm text-gray-500 mt-2">Fetching real-time data from the network</p>
            </div>
          ) : (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-16 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
                <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages found</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {selectedNetwork !== 'all' 
                  ? `No ${selectedMessageType === 'all' ? 'messages' : selectedMessageType.replace('_', ' ')} messages available for the ${selectedNetwork} network.`
                  : 'Try adjusting your filters or wait for new messages to arrive.'
                }
              </p>
              <button 
                onClick={() => {
                  setSelectedNetwork('all');
                  setSelectedMessageType('all');
                  setPeerFilter('');
                }}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all transform hover:scale-105"
              >
                Clear All Filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {pagination && data.length > 0 && (
            <div className="flex justify-center">
              <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-2">
                <PaginationComponent
                  pagination={pagination}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};