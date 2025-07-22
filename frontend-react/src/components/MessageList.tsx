import React, { useEffect, useRef } from 'react';
import { Message, PaginationInfo } from '../types/Message';
import MessageCard from './MessageCard';
import Pagination from './Pagination';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  newMessageIds: Set<number>;
  pagination?: PaginationInfo | null;
  onPageChange?: (page: number) => void;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading, 
  newMessageIds, 
  pagination,
  onPageChange 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to top when page changes
    if (containerRef.current && pagination) {
      containerRef.current.scrollTop = 0;
    }
  }, [pagination?.currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-600 rounded-full animate-pulse"></div>
            </div>
          </div>
          <p className="text-gray-600 text-lg font-medium">Loading messages...</p>
          <p className="text-gray-500 text-sm">Fetching data from Teranode network</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="text-4xl text-gray-400">📭</div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No messages found</h3>
          <p className="text-gray-500 mb-4">
            No messages match your current search criteria
          </p>
          <div className="text-sm text-gray-400">
            Try adjusting your filters or check back later for new messages
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages Container */}
      <div 
        ref={containerRef}
        className="space-y-4 max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100"
      >
        {messages.map((message, index) => (
          <div
            key={message.ID}
            className="animate-fadeIn"
            style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
          >
            <MessageCard 
              message={message} 
              isNew={newMessageIds.has(message.ID)}
            />
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination && onPageChange && (
        <div className="pt-4 border-t border-gray-200">
          <Pagination 
            pagination={pagination}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
};

export default MessageList;