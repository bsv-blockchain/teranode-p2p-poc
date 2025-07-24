import React from 'react';
import { Link } from 'react-router-dom';
import { PeerNameDisplay } from './PeerNameDisplay';

interface ClickablePeerNameDisplayProps {
  peerID: string;
  className?: string;
  linkClassName?: string;
  showBoth?: boolean;
  truncate?: boolean;
  maxLength?: number;
  fallbackText?: string;
}

export const ClickablePeerNameDisplay: React.FC<ClickablePeerNameDisplayProps> = ({ 
  peerID, 
  className = '',
  linkClassName = '',
  showBoth = false,
  truncate = true,
  maxLength = 16,
  fallbackText = 'Unknown Peer'
}) => {
  if (!peerID) {
    return <span className={className}>{fallbackText}</span>;
  }

  return (
    <Link
      to={`/peers/${peerID}`}
      className={`inline-flex items-center hover:underline transition-all duration-200 ${linkClassName}`}
      title={`View details for peer ${peerID}`}
    >
      <PeerNameDisplay 
        peerID={peerID}
        className={className}
        showBoth={showBoth}
        truncate={truncate}
        maxLength={maxLength}
        fallbackText={fallbackText}
      />
      <svg 
        className="w-3 h-3 ml-1 opacity-60 group-hover:opacity-100 transition-opacity" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
        />
      </svg>
    </Link>
  );
};