import React from 'react';
import { MessageType } from '../types/Message';

interface MessageTypeFilterProps {
  selectedType: MessageType | 'all';
  onTypeChange: (type: MessageType | 'all') => void;
  messageTypes: MessageType[];
}

const typeInfo: Record<MessageType | 'all', { label: string; icon: string; description: string }> = {
  all: { 
    label: 'All Types', 
    icon: '📊', 
    description: 'View all message types' 
  },
  bestblock: { 
    label: 'Best Block', 
    icon: '🎯', 
    description: 'Best block requests between peers' 
  },
  block: { 
    label: 'Blocks', 
    icon: '📦', 
    description: 'New block announcements' 
  },
  mining_on: { 
    label: 'Mining', 
    icon: '⛏️', 
    description: 'Mining activity notifications' 
  },
  subtree: { 
    label: 'Subtrees', 
    icon: '🌳', 
    description: 'Transaction batch announcements' 
  },
  handshake: { 
    label: 'Handshakes', 
    icon: '🤝', 
    description: 'Peer connection handshakes' 
  },
  rejected_tx: { 
    label: 'Rejected TX', 
    icon: '❌', 
    description: 'Rejected transaction notifications' 
  }
};

export const MessageTypeFilter: React.FC<MessageTypeFilterProps> = ({ 
  selectedType, 
  onTypeChange, 
  messageTypes 
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Message Type</label>
      <div className="relative">
        <select
          value={selectedType}
          onChange={(e) => onTypeChange(e.target.value as MessageType | 'all')}
          className="block w-full px-4 py-3 pr-10 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-lg appearance-none bg-white"
        >
          <option value="all">{typeInfo.all.icon} {typeInfo.all.label} - {typeInfo.all.description}</option>
          {messageTypes.map(type => (
            <option key={type} value={type}>
              {typeInfo[type].icon} {typeInfo[type].label} - {typeInfo[type].description}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      <div className="mt-1 text-sm text-gray-500">
        {selectedType === 'all' ? typeInfo.all.description : typeInfo[selectedType].description}
      </div>
    </div>
  );
};