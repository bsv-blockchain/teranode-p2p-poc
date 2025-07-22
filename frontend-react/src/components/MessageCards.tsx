import React from 'react';
import { Block, MiningOn, Subtree, Handshake, RejectedTx } from '../types/Message';

interface MessageCardBaseProps {
  className?: string;
  children: React.ReactNode;
  icon: string;
  title: string;
  network: string;
  receivedAt: string;
  isNew?: boolean;
}

const MessageCardBase: React.FC<MessageCardBaseProps> = ({ 
  className, 
  children, 
  icon, 
  title, 
  network, 
  receivedAt,
  isNew = false 
}) => {
  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown time';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid time';
      
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return date.toLocaleDateString();
    } catch (error) {
      return 'Invalid time';
    }
  };

  const getNetworkColor = (network: string) => {
    const colors: Record<string, string> = {
      mainnet: 'bg-orange-100 text-orange-800',
      testnet: 'bg-green-100 text-green-800',
      regtest: 'bg-purple-100 text-purple-800',
      stn: 'bg-blue-100 text-blue-800',
      teratestnet: 'bg-indigo-100 text-indigo-800',
      tstn: 'bg-pink-100 text-pink-800'
    };
    return colors[network] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`
      relative bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200
      ${isNew ? 'ring-2 ring-green-200 bg-green-50' : ''}
      ${className}
    `}>
      {isNew && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            New
          </span>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNetworkColor(network || '')}`}>
                {(network || 'UNKNOWN').toUpperCase()}
              </span>
              <span className="text-sm text-gray-500">{formatTime(receivedAt)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
};

interface BlockCardProps {
  block: Block;
  isNew?: boolean;
}

export const BlockCard: React.FC<BlockCardProps> = ({ block, isNew }) => (
  <MessageCardBase
    icon="📦"
    title="Block Announcement"
    network={block.Network}
    receivedAt={block.ReceivedAt}
    isNew={isNew}
  >
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-sm font-medium text-gray-500">Hash</span>
        <p className="font-mono text-sm text-gray-900 truncate" title={block.Hash}>
          {block.Hash}
        </p>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-500">Height</span>
        <p className="text-sm text-gray-900">{block.Height?.toLocaleString() || 'N/A'}</p>
      </div>
    </div>
    
    {block.DataHubURL && (
      <div>
        <span className="text-sm font-medium text-gray-500">Data Hub URL</span>
        <a 
          href={block.DataHubURL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-500 truncate block"
        >
          {block.DataHubURL}
        </a>
      </div>
    )}
    
    <div>
      <span className="text-sm font-medium text-gray-500">Peer ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={block.PeerID || ''}>
        {block.PeerID || 'N/A'}
      </p>
    </div>
  </MessageCardBase>
);

interface MiningCardProps {
  mining: MiningOn;
  isNew?: boolean;
}

export const MiningCard: React.FC<MiningCardProps> = ({ mining, isNew }) => (
  <MessageCardBase
    icon="⛏️"
    title="Mining Activity"
    network={mining.Network}
    receivedAt={mining.ReceivedAt}
    isNew={isNew}
  >
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-sm font-medium text-gray-500">Block Hash</span>
        <p className="font-mono text-sm text-gray-900 truncate" title={mining.Hash}>
          {mining.Hash}
        </p>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-500">Height</span>
        <p className="text-sm text-gray-900">{mining.Height?.toLocaleString() || 'N/A'}</p>
      </div>
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-sm font-medium text-gray-500">Size</span>
        <p className="text-sm text-gray-900">{mining.SizeInBytes ? (mining.SizeInBytes / 1024).toFixed(1) + ' KB' : 'N/A'}</p>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-500">TX Count</span>
        <p className="text-sm text-gray-900">{mining.TxCount?.toLocaleString() || 'N/A'}</p>
      </div>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Miner</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={mining.Miner}>
        {mining.Miner || 'Unknown'}
      </p>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Previous Hash</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={mining.PreviousHash}>
        {mining.PreviousHash}
      </p>
    </div>
  </MessageCardBase>
);

interface SubtreeCardProps {
  subtree: Subtree;
  isNew?: boolean;
}

export const SubtreeCard: React.FC<SubtreeCardProps> = ({ subtree, isNew }) => (
  <MessageCardBase
    icon="🌳"
    title="Subtree Announcement"
    network={subtree.Network}
    receivedAt={subtree.ReceivedAt}
    isNew={isNew}
  >
    <div>
      <span className="text-sm font-medium text-gray-500">Hash</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={subtree.Hash || ''}>
        {subtree.Hash || 'N/A'}
      </p>
    </div>
    
    {subtree.DataHubURL && (
      <div>
        <span className="text-sm font-medium text-gray-500">Data Hub URL</span>
        <a 
          href={subtree.DataHubURL} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-500 truncate block"
        >
          {subtree.DataHubURL}
        </a>
      </div>
    )}
    
    <div>
      <span className="text-sm font-medium text-gray-500">Peer ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={subtree.PeerID || ''}>
        {subtree.PeerID || 'N/A'}
      </p>
    </div>
  </MessageCardBase>
);

interface HandshakeCardProps {
  handshake: Handshake;
  isNew?: boolean;
}

export const HandshakeCard: React.FC<HandshakeCardProps> = ({ handshake, isNew }) => (
  <MessageCardBase
    icon="🤝"
    title={`Handshake - ${(handshake.Type || 'UNKNOWN').toUpperCase()}`}
    network={handshake.Network}
    receivedAt={handshake.ReceivedAt}
    isNew={isNew}
  >
    <div className="grid grid-cols-2 gap-4">
      <div>
        <span className="text-sm font-medium text-gray-500">Best Height</span>
        <p className="text-sm text-gray-900">{handshake.BestHeight?.toLocaleString() || 'N/A'}</p>
      </div>
      <div>
        <span className="text-sm font-medium text-gray-500">Services</span>
        <p className="text-sm text-gray-900">{handshake.Services ? '0x' + handshake.Services.toString(16) : 'N/A'}</p>
      </div>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Best Hash</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={handshake.BestHash || ''}>
        {handshake.BestHash || 'N/A'}
      </p>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">User Agent</span>
      <p className="text-sm text-gray-900">{handshake.UserAgent || 'Unknown'}</p>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Peer ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={handshake.PeerID || ''}>
        {handshake.PeerID || 'N/A'}
      </p>
    </div>
  </MessageCardBase>
);

interface RejectedTxCardProps {
  rejectedTx: RejectedTx;
  isNew?: boolean;
}

export const RejectedTxCard: React.FC<RejectedTxCardProps> = ({ rejectedTx, isNew }) => (
  <MessageCardBase
    icon="❌"
    title="Rejected Transaction"
    network={rejectedTx.Network}
    receivedAt={rejectedTx.ReceivedAt}
    isNew={isNew}
    className="border-l-4 border-l-red-400"
  >
    <div>
      <span className="text-sm font-medium text-gray-500">Transaction ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={rejectedTx.TxID || ''}>
        {rejectedTx.TxID || 'N/A'}
      </p>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Reason</span>
      <p className="text-sm text-gray-900 bg-red-50 p-2 rounded">
        {rejectedTx.Reason || 'No reason provided'}
      </p>
    </div>
    
    <div>
      <span className="text-sm font-medium text-gray-500">Peer ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={rejectedTx.PeerID || ''}>
        {rejectedTx.PeerID || 'N/A'}
      </p>
    </div>
  </MessageCardBase>
);

