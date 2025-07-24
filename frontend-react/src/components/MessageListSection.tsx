import React, { useState, useEffect } from 'react';
import { Message, ApiResponse, Block, MiningOn, Subtree, Handshake, RejectedTx } from '../types/Message';
import { ApiService } from '../services/api';
import { MessageParser } from '../utils/messageParser';
import { BlockCard, MiningCard, SubtreeCard, HandshakeCard, RejectedTxCard } from './MessageCards';
import Pagination from './Pagination';

interface MessageListSectionProps {
  peerID: string;
  availableTopics: string[];
}

export const MessageListSection: React.FC<MessageListSectionProps> = ({ peerID, availableTopics }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageSize = 10;

  useEffect(() => {
    fetchMessages();
  }, [peerID, selectedTopic, currentPage]);

  const fetchMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const filters = {
        peer: peerID,
        page: currentPage,
        limit: pageSize,
        ...(selectedTopic !== 'all' && { topic: selectedTopic })
      };
      
      const response: ApiResponse = await ApiService.getMessages(filters);
      setMessages(response.messages);
      setPaginationInfo(response.pagination);
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error fetching messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setCurrentPage(1); // Reset to first page when changing topic
  };

  // Extract unique topics from available topics
  const uniqueTopics = Array.from(new Set(availableTopics)).sort();

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 mb-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Recent Messages</h2>
        </div>
        
        {/* Topic Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="topic-filter" className="text-sm font-medium text-gray-700">Topic:</label>
          <select
            id="topic-filter"
            value={selectedTopic}
            onChange={(e) => handleTopicChange(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Topics</option>
            {uniqueTopics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
          </div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-600">
            {selectedTopic === 'all' 
              ? 'No messages found from this peer' 
              : `No messages found for topic: ${selectedTopic}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => {
            // Parse the message to get the typed version
            const parsedMessage = MessageParser.parseWebSocketMessage(message);
            
            // Extract message type from topic
            const topicParts = message.Topic.split('-');
            const messageType = topicParts.length > 1 ? topicParts[topicParts.length - 1] : '';
            
            // Render the appropriate card based on message type
            switch (messageType) {
              case 'block':
                return <BlockCard key={message.ID} block={parsedMessage as Block} isNew={false} />;
              case 'miningon':
                return <MiningCard key={message.ID} mining={parsedMessage as MiningOn} isNew={false} />;
              case 'subtree':
                return <SubtreeCard key={message.ID} subtree={parsedMessage as Subtree} isNew={false} />;
              case 'handshake':
                return <HandshakeCard key={message.ID} handshake={parsedMessage as Handshake} isNew={false} />;
              case 'rejected_tx':
                return <RejectedTxCard key={message.ID} rejectedTx={parsedMessage as RejectedTx} isNew={false} />;
              default:
                // Skip unknown message types
                console.warn('Unknown message type:', messageType, 'for message:', message);
                return null;
            }
          })}
          
          {/* Pagination */}
          {paginationInfo && paginationInfo.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                pagination={paginationInfo}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};