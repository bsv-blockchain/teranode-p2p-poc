import React from 'react';
import { usePeerName } from '../hooks/usePeerName';

interface PeerNameDisplayProps {
  peerID: string;
  className?: string;
  showBoth?: boolean;
  truncate?: boolean;
  maxLength?: number;
  fallbackText?: string;
}

export const PeerNameDisplay: React.FC<PeerNameDisplayProps> = ({ 
  peerID, 
  className = '',
  showBoth = false,
  truncate = true,
  maxLength = 16,
  fallbackText = 'Unknown Peer'
}) => {
  const { friendlyName } = usePeerName(peerID);

  if (!peerID) {
    return <span className={className}>{fallbackText}</span>;
  }

  const truncatePeerID = (id: string) => {
    if (!truncate || id.length <= maxLength) return id;
    return `${id.substring(0, maxLength)}...`;
  };

  if (friendlyName) {
    if (showBoth) {
      return (
        <span className={className}>
          <span className="font-medium">{friendlyName}</span>
          <span className="text-gray-500 ml-1">({truncatePeerID(peerID)})</span>
        </span>
      );
    }
    return <span className={`font-medium ${className}`}>{friendlyName}</span>;
  }

  return (
    <span className={`font-mono ${className}`}>
      {truncatePeerID(peerID)}
    </span>
  );
};