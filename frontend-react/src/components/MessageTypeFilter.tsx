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
  block: { 
    label: 'Blocks', 
    icon: '📦', 
    description: 'New block announcements' 
  },
  miningon: { 
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-gray-800">Message Type</label>
        <span className="text-xs text-gray-500">{messageTypes.length} types available</span>
      </div>
      
      {/* Custom Select with Cards */}
      <div className="space-y-2">
        <div className="relative group">
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as MessageType | 'all')}
            className="block w-full px-4 py-3.5 pr-10 text-sm font-medium text-gray-800 bg-white border-2 border-gray-200 rounded-xl appearance-none transition-all duration-200 focus:outline-none focus:border-[#1B1EA9] focus:ring-4 focus:ring-[#1B1EA9]/10 hover:border-gray-300 cursor-pointer"
          >
            <option value="all">{typeInfo.all.icon} {typeInfo.all.label}</option>
            {messageTypes.map(type => {
              if (!typeInfo[type]) return null;
              return (
                <option key={type} value={type}>
                  {typeInfo[type].icon} {typeInfo[type].label}
                </option>
              );
            })}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-700 transition-colors" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        
        {/* Selected Type Info Card */}
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg border border-gray-200/50">
          <div className="text-2xl">{typeInfo[selectedType]?.icon || typeInfo.all.icon}</div>
          <div>
            <div className="text-sm font-medium text-gray-800">
              {typeInfo[selectedType]?.label || typeInfo.all.label}
            </div>
            <div className="text-xs text-gray-600">
              {typeInfo[selectedType]?.description || typeInfo.all.description}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};