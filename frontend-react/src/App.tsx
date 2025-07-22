import React, { useState, useCallback, useEffect } from 'react';
import { Message, SearchFilters, PaginationInfo, ApiResponse } from './types/Message';
import { ApiService } from './services/api';
import { useWebSocket } from './hooks/useWebSocket';
import SearchForm from './components/SearchForm';
import MessageList from './components/MessageList';
import WebSocketStatusComponent from './components/WebSocketStatus';
import MessageStatsComponent from './components/MessageStats';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [newMessageIds, setNewMessageIds] = useState<Set<number>>(new Set());
  const [currentFilters, setCurrentFilters] = useState<SearchFilters>({});

  const handleWebSocketMessage = useCallback((message: Message) => {
    // Only add to current view if we're on the first page with no filters
    if (pagination?.currentPage === 1 && !currentFilters.topic && !currentFilters.peer) {
      setMessages(prev => [message, ...prev.slice(0, (pagination?.pageSize || 20) - 1)]);
    }
    
    setNewMessageIds(prev => new Set(prev).add(message.ID));
    setStatusMessage('New realtime message received.');
    
    // Remove the "new" indicator after 3 seconds
    setTimeout(() => {
      setNewMessageIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(message.ID);
        return newSet;
      });
    }, 3000);
  }, [pagination?.currentPage, pagination?.pageSize, currentFilters]);

  const { status: wsStatus, reconnect } = useWebSocket(handleWebSocketMessage);

  const handleSearch = useCallback(async (filters: SearchFilters) => {
    setIsLoading(true);
    setStatusMessage('Searching...');
    setCurrentFilters(filters);
    
    try {
      const response: ApiResponse = await ApiService.getMessages(filters);
      setMessages(response.messages);
      setPagination(response.pagination);
      setStatusMessage(`Found ${response.pagination.totalItems} messages.`);
      setNewMessageIds(new Set()); // Clear new message indicators
    } catch (error) {
      setStatusMessage('Error fetching messages.');
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePageChange = useCallback((page: number) => {
    const newFilters = { ...currentFilters, page };
    handleSearch(newFilters);
  }, [currentFilters, handleSearch]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setPagination(null);
    setStatusMessage('');
    setNewMessageIds(new Set());
    setCurrentFilters({});
  }, []);

  // Load initial messages
  useEffect(() => {
    handleSearch({ page: 1, limit: 20 });
  }, [handleSearch]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Teranode Network
              </h1>
              <p className="text-gray-600 mt-2">Real-time P2P message monitoring and analytics</p>
            </div>
            <WebSocketStatusComponent status={wsStatus} onReconnect={reconnect} />
          </div>
          
          {/* Stats Section */}
          <MessageStatsComponent className="mb-6" />
        </header>

        {/* Search Form */}
        <SearchForm 
          onSearch={handleSearch}
          onClear={handleClear}
          isLoading={isLoading}
        />

        {/* Main Content */}
        <main className="bg-white rounded-3xl shadow-xl border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Messages</h2>
              <p className="text-gray-600">Live network activity and historical data</p>
            </div>
          </div>

          <MessageList 
            messages={messages}
            isLoading={isLoading}
            newMessageIds={newMessageIds}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        </main>

        {/* Status Footer */}
        {statusMessage && (
          <footer className="mt-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              {statusMessage}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

export default App;
