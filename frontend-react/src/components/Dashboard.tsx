import React, { useState, useEffect, useCallback } from 'react';
import { ApiService } from '../services/api';
import { MessageAggregatorService } from '../services/messageAggregator';
import { MessageParser } from '../utils/messageParser';
import { useWebSocket } from '../hooks/useWebSocket';
import { NetworkSelector } from './NetworkSelector';
import { MessageTypeFilter } from './MessageTypeFilter';
import { PeerFilter } from './PeerFilter';
import PaginationComponent from './Pagination';
import MessageStatsComponent from './MessageStats';
import WebSocketStatusComponent from './WebSocketStatus';
import { 
  BlockCard, 
  MiningCard, 
  SubtreeCard, 
  HandshakeCard, 
  RejectedTxCard, 
  BestBlockCard 
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
  BestBlockRequest,
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

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: Message) => {
    // Only add to current view if we're on the first page with basic filters
    if (currentPage === 1 && !peerFilter) {
      // Parse the message to get structured data
      const parsedMessage = MessageParser.parseWebSocketMessage(message);
      
      // Check if message matches current filters
      const messageNetwork = message.Topic.split('/')[1]?.split('-')[0];
      const messageType = message.Topic.split('-')[1];
      
      const matchesNetwork = selectedNetwork === 'all' || messageNetwork === selectedNetwork;
      const matchesType = selectedMessageType === 'all' || messageType === selectedMessageType;
      
      if (matchesNetwork && matchesType) {
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
        const [networksData, messageTypesData] = await Promise.all([
          ApiService.getNetworks(),
          ApiService.getMessageTypes()
        ]);
        setNetworks(networksData);
        setMessageTypes(messageTypesData);
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
    
    // When viewing all messages, detect the message type from the Topic
    let messageType = selectedMessageType;
    if (selectedMessageType === 'all' && item.Topic) {
      // Extract message type from topic (e.g., "/mainnet-block" -> "block")
      const topicParts = item.Topic.split('-');
      if (topicParts.length > 1) {
        messageType = topicParts[topicParts.length - 1] as MessageType;
      }
    }
    
    switch (messageType) {
      case 'block':
        return <BlockCard key={item.ID || index} block={item as Block} isNew={isNew} />;
      case 'mining_on':
        return <MiningCard key={item.ID || index} mining={item as MiningOn} isNew={isNew} />;
      case 'subtree':
        return <SubtreeCard key={item.ID || index} subtree={item as Subtree} isNew={isNew} />;
      case 'handshake':
        return <HandshakeCard key={item.ID || index} handshake={item as Handshake} isNew={isNew} />;
      case 'rejected_tx':
        return <RejectedTxCard key={item.ID || index} rejectedTx={item as RejectedTx} isNew={isNew} />;
      case 'bestblock':
        return <BestBlockCard key={item.ID || index} bestBlock={item as BestBlockRequest} isNew={isNew} />;
      default:
        // Fallback for generic messages or when showing all types
        return (
          <div key={item.ID || index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📨</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Message</h3>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-gray-500">
                      {new Date(item.ReceivedAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p><span className="font-medium">Topic:</span> {(item as Message).Topic}</p>
              <p><span className="font-medium">Peer:</span> {(item as Message).Peer}</p>
              <details className="bg-gray-50 rounded p-3">
                <summary className="cursor-pointer font-medium">Raw Data</summary>
                <pre className="mt-2 text-xs overflow-auto">{(item as Message).Data}</pre>
              </details>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top Header with Network Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <img 
                src="/bsv-logo.svg" 
                alt="BSV Association" 
                className="h-8 w-auto"
              />
              <div className="border-l-2 border-gray-300 pl-4">
                <h1 className="text-3xl font-display font-bold text-bsv-primary">Teranode P2P Monitor</h1>
                <p className="mt-1 text-bsv-text">Real-time Bitcoin SV network message monitoring</p>
              </div>
            </div>
            <WebSocketStatusComponent status={wsStatus} onReconnect={reconnect} />
          </div>
          
          {/* Network Selection - Prominent at Top */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <NetworkSelector
              selectedNetwork={selectedNetwork}
              onNetworkChange={setSelectedNetwork}
              networks={networks}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6">
          <MessageStatsComponent />
        </div>

        {/* Secondary Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Message Filters</h2>
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="space-y-6">
          {/* Results Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedNetwork !== 'all' && `${selectedNetwork.toUpperCase()} Network - `}
                {selectedMessageType === 'all' ? 'All Messages' : 
                 selectedMessageType.charAt(0).toUpperCase() + selectedMessageType.slice(1).replace('_', ' ')}
              </h2>
              {pagination && (
                <span className="text-sm text-gray-500">
                  {pagination.totalItems} total results
                </span>
              )}
            </div>
            
            {loading && (
              <div className="flex items-center space-x-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                <span className="text-sm">Loading...</span>
              </div>
            )}
          </div>

          {/* Messages Grid */}
          {data.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {data.map((item, index) => renderMessageCard(item, index))}
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading messages...</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0v9h3v-4a1 1 0 011-1h2a1 1 0 011 1v4h3v-9" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No messages found</h3>
              <p className="text-gray-500">
                {selectedNetwork !== 'all' 
                  ? `No ${selectedMessageType === 'all' ? 'messages' : selectedMessageType} messages found for ${selectedNetwork} network.`
                  : 'Try adjusting your filters to see different results.'
                }
              </p>
            </div>
          )}

          {/* Pagination */}
          {pagination && data.length > 0 && (
            <div className="flex justify-center">
              <PaginationComponent
                pagination={pagination}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};