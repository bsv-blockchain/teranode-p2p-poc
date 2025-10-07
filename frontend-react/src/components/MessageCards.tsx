import React from 'react';
import { Block, MiningOn, Subtree, Handshake, RejectedTx, NodeStatus } from '../types/Message';
import { ClickablePeerNameDisplay } from './ClickablePeerNameDisplay';

interface MessageCardBaseProps {
  className?: string;
  children: React.ReactNode;
  icon: string;
  title: string;
  network: string;
  receivedAt: string;
  isNew?: boolean;
  sentFromPeer?: string;
  peerID?: string;
}

const MessageCardBase: React.FC<MessageCardBaseProps> = ({ 
  className, 
  children, 
  icon, 
  title, 
  network, 
  receivedAt,
  isNew = false,
  sentFromPeer,
  peerID
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
      relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow duration-200
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
      
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="flex items-start space-x-2 sm:space-x-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">{title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getNetworkColor(network || '')}`}>
                {(network || 'UNKNOWN').toUpperCase()}
              </span>
              <span className="text-xs sm:text-sm text-gray-500">{formatTime(receivedAt)}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        {children}
        
        {/* Show peer information if we have it */}
        {(sentFromPeer || peerID) && (
          <div className="border-t border-gray-100 pt-3 space-y-2">
            {/* Show both peers if they're different */}
            {sentFromPeer && peerID && sentFromPeer !== peerID ? (
              <>
                <div>
                  <span className="text-xs sm:text-sm font-medium text-gray-500">Sent from Peer</span>
                  <div className="text-xs sm:text-sm text-gray-700">
                    <ClickablePeerNameDisplay 
                      peerID={sentFromPeer} 
                      showBoth={true}
                      className="text-gray-700 hover:text-gray-900"
                      linkClassName="group"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-medium text-gray-500">Message Peer ID</span>
                  <div className="text-xs sm:text-sm text-gray-900">
                    <ClickablePeerNameDisplay 
                      peerID={peerID} 
                      showBoth={true}
                      className="text-gray-900 hover:text-indigo-600"
                      linkClassName="group"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Show single peer ID if they're the same or only one exists */
              <div>
                <span className="text-xs sm:text-sm font-medium text-gray-500">Peer ID</span>
                <div className="text-xs sm:text-sm text-gray-900">
                  <ClickablePeerNameDisplay 
                    peerID={peerID || sentFromPeer || ''} 
                    showBoth={true}
                    className="text-gray-900 hover:text-indigo-600"
                    linkClassName="group"
                  />
                </div>
              </div>
            )}
          </div>
        )}
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
    sentFromPeer={block.sentFromPeer}
    peerID={block.PeerID}
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div>
        <span className="text-xs sm:text-sm font-medium text-gray-500">Hash</span>
        <p className="font-mono text-xs sm:text-sm text-gray-900 truncate" title={block.Hash}>
          {block.Hash}
        </p>
      </div>
      <div>
        <span className="text-xs sm:text-sm font-medium text-gray-500">Height</span>
        <p className="text-xs sm:text-sm text-gray-900">{block.Height?.toLocaleString() || 'N/A'}</p>
      </div>
      {block.Header && (
        <div className="col-span-full">
          <span className="text-xs sm:text-sm font-medium text-gray-500">Block Header Available</span>
          <p className="text-xs sm:text-sm text-green-600">✓ Full header data stored</p>
        </div>
      )}
    </div>
  </MessageCardBase>
);

// Temporarily commenting out MiningCard component
// interface MiningCardProps {
//   mining: MiningOn;
//   isNew?: boolean;
// }

// export const MiningCard: React.FC<MiningCardProps> = ({ mining, isNew }) => (
//   <MessageCardBase
//     icon="⛏️"
//     title="Mining Activity"
//     network={mining.Network}
//     receivedAt={mining.ReceivedAt}
//     isNew={isNew}
//     sentFromPeer={mining.sentFromPeer}
//     peerID={mining.PeerID}
//   >
//     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//       <div>
//         <span className="text-xs sm:text-sm font-medium text-gray-500">Block Hash</span>
//         <p className="font-mono text-xs sm:text-sm text-gray-900 truncate" title={mining.Hash}>
//           {mining.Hash}
//         </p>
//       </div>
//       <div>
//         <span className="text-xs sm:text-sm font-medium text-gray-500">Height</span>
//         <p className="text-xs sm:text-sm text-gray-900">{mining.Height?.toLocaleString() || 'N/A'}</p>
//       </div>
//     </div>
    
//     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
//       <div>
//         <span className="text-xs sm:text-sm font-medium text-gray-500">Size</span>
//         <p className="text-xs sm:text-sm text-gray-900">{mining.SizeInBytes ? (mining.SizeInBytes / 1024).toFixed(1) + ' KB' : 'N/A'}</p>
//       </div>
//       <div>
//         <span className="text-xs sm:text-sm font-medium text-gray-500">TX Count</span>
//         <p className="text-xs sm:text-sm text-gray-900">{mining.TxCount?.toLocaleString() || 'N/A'}</p>
//       </div>
//     </div>
    
//     <div>
//       <span className="text-sm font-medium text-gray-500">Miner</span>
//       <p className="font-mono text-sm text-gray-900 truncate" title={mining.Miner}>
//         {mining.Miner || 'Unknown'}
//       </p>
//     </div>
    
//     <div>
//       <span className="text-sm font-medium text-gray-500">Previous Hash</span>
//       <p className="font-mono text-sm text-gray-900 truncate" title={mining.PreviousHash}>
//         {mining.PreviousHash}
//       </p>
//     </div>
//   </MessageCardBase>
// );

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
    sentFromPeer={subtree.sentFromPeer}
    peerID={subtree.PeerID}
  >
    <div>
      <span className="text-sm font-medium text-gray-500">Hash</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={subtree.Hash || ''}>
        {subtree.Hash || 'N/A'}
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
    sentFromPeer={handshake.sentFromPeer}
    peerID={handshake.PeerID}
  >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Best Height</span>
          <p className="text-xs sm:text-sm text-gray-900">
            {handshake.BestHeight !== undefined && handshake.BestHeight !== null 
              ? handshake.BestHeight.toLocaleString() 
              : 'N/A'}
          </p>
        </div>
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Services</span>
          <p className="text-xs sm:text-sm text-gray-900">
            {handshake.Services !== undefined && handshake.Services !== null 
              ? '0x' + handshake.Services.toString(16) 
              : 'N/A'}
          </p>
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
    sentFromPeer={rejectedTx.sentFromPeer}
    peerID={rejectedTx.PeerID}
  >
    <div>
      <span className="text-sm font-medium text-gray-500">Transaction ID</span>
      <p className="font-mono text-sm text-gray-900 truncate" title={rejectedTx.TxID || ''}>
        {rejectedTx.TxID || 'N/A'}
      </p>
    </div>

    <div>
      <span className="text-xs sm:text-sm font-medium text-gray-500">Reason</span>
      <p className="text-xs sm:text-sm text-gray-900 bg-red-50 p-2 rounded break-words">
        {rejectedTx.Reason || 'No reason provided'}
      </p>
    </div>
  </MessageCardBase>
);

interface NodeStatusCardProps {
  nodeStatus: NodeStatus;
  isNew?: boolean;
}

export const NodeStatusCard: React.FC<NodeStatusCardProps> = ({ nodeStatus, isNew }) => {
  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return 'N/A';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatStartTime = (timestamp: number): string => {
    if (!timestamp || timestamp <= 0) return 'N/A';
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleString();
    } catch {
      return 'N/A';
    }
  };

  const formatSyncTime = (timestamp: number): string => {
    if (!timestamp || timestamp <= 0) return 'N/A';
    try {
      const date = new Date(timestamp * 1000);
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
      if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
      if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
      return `${Math.floor(diffInSeconds / 86400)}d ago`;
    } catch {
      return 'N/A';
    }
  };

  const getFSMStateColor = (state: string): string => {
    const stateColors: Record<string, string> = {
      'running': 'text-green-600',
      'syncing': 'text-blue-600',
      'stopped': 'text-red-600',
      'paused': 'text-yellow-600',
      'idle': 'text-gray-600'
    };
    return stateColors[state?.toLowerCase()] || 'text-gray-600';
  };

  return (
    <MessageCardBase
      icon="🖥️"
      title={`Node Status - ${nodeStatus.Type || 'UNKNOWN'}`}
      network={nodeStatus.Network}
      receivedAt={nodeStatus.ReceivedAt}
      isNew={isNew}
      className="border-l-4 border-l-blue-400"
      sentFromPeer={nodeStatus.sentFromPeer}
      peerID={nodeStatus.PeerID}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Client Name</span>
          <p className="text-xs sm:text-sm text-gray-900">{nodeStatus.ClientName || 'Unknown'}</p>
        </div>
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Version</span>
          <p className="text-xs sm:text-sm text-gray-900">{nodeStatus.Version || 'N/A'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Best Height</span>
          <p className="text-xs sm:text-sm text-gray-900">
            {nodeStatus.BestHeight?.toLocaleString() || 'N/A'}
          </p>
        </div>
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">FSM State</span>
          <p className={`text-xs sm:text-sm font-semibold ${getFSMStateColor(nodeStatus.FSMState)}`}>
            {nodeStatus.FSMState || 'Unknown'}
          </p>
        </div>
      </div>

      <div>
        <span className="text-sm font-medium text-gray-500">Best Block Hash</span>
        <p className="font-mono text-sm text-gray-900 truncate" title={nodeStatus.BestBlockHash || ''}>
          {nodeStatus.BestBlockHash || 'N/A'}
        </p>
      </div>

      {nodeStatus.CommitHash && (
        <div>
          <span className="text-sm font-medium text-gray-500">Commit Hash</span>
          <p className="font-mono text-sm text-gray-900 truncate" title={nodeStatus.CommitHash}>
            {nodeStatus.CommitHash.substring(0, 12)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Uptime</span>
          <p className="text-xs sm:text-sm text-gray-900">{formatUptime(nodeStatus.Uptime)}</p>
        </div>
        <div>
          <span className="text-xs sm:text-sm font-medium text-gray-500">Started</span>
          <p className="text-xs sm:text-sm text-gray-900">{formatStartTime(nodeStatus.StartTime)}</p>
        </div>
      </div>

      {nodeStatus.MinerName && (
        <div>
          <span className="text-sm font-medium text-gray-500">Miner</span>
          <p className="text-sm text-gray-900">{nodeStatus.MinerName}</p>
        </div>
      )}

      {nodeStatus.ListenMode && (
        <div>
          <span className="text-sm font-medium text-gray-500">Listen Mode</span>
          <p className="text-sm text-gray-900">{nodeStatus.ListenMode}</p>
        </div>
      )}

      {nodeStatus.ChainWork && (
        <div>
          <span className="text-sm font-medium text-gray-500">Chain Work</span>
          <p className="font-mono text-xs text-gray-900 truncate" title={nodeStatus.ChainWork}>
            {nodeStatus.ChainWork}
          </p>
        </div>
      )}

      {nodeStatus.MinMiningTxFee !== undefined && nodeStatus.MinMiningTxFee !== null && (
        <div>
          <span className="text-sm font-medium text-gray-500">Min Mining TX Fee</span>
          <p className="text-sm text-gray-900">
            {nodeStatus.MinMiningTxFee === 0 ? 'No fee' : nodeStatus.MinMiningTxFee.toFixed(8) + ' BSV/byte'}
          </p>
        </div>
      )}

      {nodeStatus.SyncPeerID && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="font-semibold text-sm text-gray-700">Sync Information</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Sync Peer</span>
              <div className="text-xs sm:text-sm text-gray-900">
                <ClickablePeerNameDisplay
                  peerID={nodeStatus.SyncPeerID}
                  showBoth={true}
                  className="text-gray-700 hover:text-gray-900"
                />
              </div>
            </div>
            <div>
              <span className="text-xs sm:text-sm font-medium text-gray-500">Sync Height</span>
              <p className="text-xs sm:text-sm text-gray-900">
                {nodeStatus.SyncPeerHeight?.toLocaleString() || 'N/A'}
              </p>
            </div>
          </div>
          {nodeStatus.SyncPeerBlockHash && (
            <div>
              <span className="text-sm font-medium text-gray-500">Sync Block Hash</span>
              <p className="font-mono text-xs text-gray-900 truncate" title={nodeStatus.SyncPeerBlockHash}>
                {nodeStatus.SyncPeerBlockHash}
              </p>
            </div>
          )}
          {nodeStatus.SyncConnectedAt && (
            <div>
              <span className="text-sm font-medium text-gray-500">Connected</span>
              <p className="text-sm text-gray-900">{formatSyncTime(nodeStatus.SyncConnectedAt)}</p>
            </div>
          )}
        </div>
      )}
    </MessageCardBase>
  );
};

