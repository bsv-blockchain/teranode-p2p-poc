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
  const [selectedNetwork, setSelectedNetwork] = useState<Network | 'all'>('mainnet');
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
                      <img src="https://bsvassociation.org/wp-content/uploads/2025/05/logo-footer.svg" alt="BSV Logo" className="w-full h-full" />
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">Teranode P2P Monitor</h1>
                      <p className="text-lg sm:text-xl text-white/90">Real-time BSV Blockchain Network Intelligence</p>
                    </div>
                  </div>
                  
                  <p className="text-base sm:text-lg text-white/80 leading-relaxed mb-6 max-w-3xl">
                    Welcome to the Teranode P2P Monitor, your window into the BSV Blockchain network's peer-to-peer communication layer. 
                    This platform provides real-time visibility into network messages, peer interactions, and blockchain activity across 
                    multiple BSV networks. Monitor block propagation, transaction flows, and network health metrics as they happen, 
                    giving developers and operators unprecedented insight into the Teranode infrastructure.
                  </p>
                  
                  <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-full border border-white/20 shadow-lg">
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                      <div className="relative w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-sm font-semibold text-white">Live Monitoring</span>
                    <div className="flex gap-1">
                      <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
                
                {/* Right Side - Network Stats */}
                <div className="lg:flex-shrink-0 lg:w-96">
                  <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20">
                    <h3 className="text-lg font-semibold text-white/90 mb-4">Network Overview</h3>
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-white/10 rounded-xl p-4">
                        <div className="text-3xl font-bold text-white">{stats.totalMessages.toLocaleString()}</div>
                        <div className="text-sm text-white/70">Total Messages</div>
                      </div>
                      <div className="bg-white/10 rounded-xl p-4">
                        <div className="text-3xl font-bold text-white">{stats.uniquePeers}</div>
                        <div className="text-sm text-white/70">Active Peers</div>
                      </div>
                    </div>
                    
                    {/* Network Activity Visualization */}
                    <div className="bg-white/10 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-white/70">Network Activity</span>
                        <span className="text-xs text-green-400">● Live</span>
                      </div>
                      <div className="flex items-end gap-1 h-12">
                        {[40, 70, 55, 85, 60, 90, 45, 75, 65, 50, 80, 55].map((height, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-gradient-to-t from-[#FF2DAF] to-[#1B1EA9] rounded-t animate-pulse opacity-80"
                            style={{
                              height: `${height}%`,
                              animationDelay: `${i * 100}ms`
                            }}
                          />
                        ))}
                      </div>
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

        {/* Network Selection - Elevated Design */}
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


        {/* Secondary Filters - Modern Design */}
        <div className="relative mb-8">
          {/* Gradient Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#1B1EA9]/5 via-[#FF2DAF]/5 to-[#1B1EA9]/5 rounded-3xl blur-xl"></div>
          
          <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 overflow-hidden">
            {/* Header with Gradient Border */}
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
                        Advanced Filters
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">Refine your search with precision</p>
                    </div>
                  </div>
                  
                  {/* Active Filter Count */}
                  {(selectedMessageType !== 'all' || peerFilter) && (
                    <div className="flex items-center gap-2 bg-gradient-to-r from-[#1B1EA9]/10 to-[#FF2DAF]/10 px-4 py-2 rounded-full">
                      <span className="text-sm font-medium text-gray-700">
                        {[selectedMessageType !== 'all' ? 1 : 0, peerFilter ? 1 : 0].reduce((a, b) => a + b, 0)} active
                      </span>
                      <button
                        onClick={() => {
                          setSelectedMessageType('all');
                          setPeerFilter('');
                        }}
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Message Type Filter with Enhanced Styling */}
                <div className="group">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500"></div>
                    <div className="relative bg-gray-50/50 rounded-2xl p-6 border border-gray-200/50 hover:border-gray-300/50 transition-all duration-300">
                      <MessageTypeFilter
                        selectedType={selectedMessageType}
                        onTypeChange={setSelectedMessageType}
                        messageTypes={messageTypes}
                      />
                    </div>
                  </div>
                </div>
                
                {/* Peer Filter with Enhanced Styling */}
                <div className="group">
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#FF2DAF] to-[#1B1EA9] rounded-2xl blur opacity-0 group-hover:opacity-30 transition duration-500"></div>
                    <div className="relative bg-gray-50/50 rounded-2xl p-6 border border-gray-200/50 hover:border-gray-300/50 transition-all duration-300">
                      <PeerFilter
                        value={peerFilter}
                        onChange={setPeerFilter}
                        recentPeers={recentPeers}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Filter Summary Bar */}
              <div className="mt-6 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-600">
                    Showing {selectedMessageType === 'all' ? 'all message types' : selectedMessageType.replace('_', ' ')} 
                    {peerFilter && ` from peer ${peerFilter.slice(0, 8)}...`}
                  </span>
                </div>
                {loading && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#1B1EA9] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#FF2DAF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[#1B1EA9] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                )}
              </div>
            </div>
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
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] text-white mr-2">
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
                <div className="flex items-center gap-3 bg-[#1B1EA9]/10 px-4 py-2 rounded-full">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#1B1EA9] border-t-transparent"></div>
                  <span className="text-sm font-medium text-[#1B1EA9]">Updating...</span>
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
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#1B1EA9] to-[#FF2DAF] rounded-full mb-6">
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
                  setSelectedNetwork('mainnet');
                  setSelectedMessageType('all');
                  setPeerFilter('');
                }}
                className="mt-6 px-6 py-3 bg-gradient-to-r from-[#1B1EA9] to-[#FF2DAF] text-white rounded-xl font-medium hover:from-[#1515A0] hover:to-[#FF1FA0] transition-all transform hover:scale-105"
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