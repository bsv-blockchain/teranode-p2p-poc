import React, { useState } from 'react';
import { Message } from '../types/Message';
import JsonViewer from './JsonViewer';

interface MessageCardProps {
  message: Message;
  isNew?: boolean;
}

const MessageCard: React.FC<MessageCardProps> = ({ message, isNew = false }) => {
  const [showFullPeer, setShowFullPeer] = useState(false);

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
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const truncatePeer = (peer: string) => {
    if (peer.length > 20) {
      return peer.substring(0, 20) + '...';
    }
    return peer;
  };

  const getTopicColor = (topic: string) => {
    const hash = topic.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200',
      'bg-red-100 text-red-800 border-red-200'
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-500 hover:shadow-xl hover:shadow-gray-200/50 ${
      isNew 
        ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-lg shadow-emerald-100/50 animate-pulse' 
        : 'border-gray-200 bg-gradient-to-br from-white to-gray-50/50 hover:border-gray-300 hover:scale-[1.02]'
    }`}>
      {/* New message indicator */}
      {isNew && (
        <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-emerald-500">
          <div className="absolute -top-4 -right-1 text-white text-xs font-bold">
            ✨
          </div>
        </div>
      )}
      
      <div className="p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold border-2 ${getTopicColor(message.Topic)}`}>
            <span className="w-2 h-2 rounded-full bg-current opacity-60"></span>
            {message.Topic}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-gray-400">from</span>
            <button
              onClick={() => setShowFullPeer(!showFullPeer)}
              className="font-mono font-medium hover:text-gray-800 transition-colors"
              title={showFullPeer ? 'Click to collapse' : 'Click to expand'}
            >
              {showFullPeer ? message.Peer : truncatePeer(message.Peer)}
            </button>
          </div>
          
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              ID: {message.ID}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              {formatTime(message.ReceivedAt)}
            </span>
          </div>
        </div>
        
        {/* Message Data */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-700">Message Data</h3>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          
          <JsonViewer 
            data={message.Data} 
            maxLines={8}
            className="transition-all duration-300 group-hover:shadow-sm"
          />
        </div>
      </div>
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform translate-x-[-100%] group-hover:translate-x-[200%]"></div>
    </div>
  );
};

export default MessageCard;