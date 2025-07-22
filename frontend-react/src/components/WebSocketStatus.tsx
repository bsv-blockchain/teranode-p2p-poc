import React from 'react';
import { WebSocketStatus } from '../types/Message';

interface WebSocketStatusProps {
  status: WebSocketStatus;
  onReconnect: () => void;
}

const WebSocketStatusComponent: React.FC<WebSocketStatusProps> = ({ status, onReconnect }) => {
  const getStatusConfig = () => {
    switch (status) {
      case WebSocketStatus.CONNECTED:
        return {
          text: 'Live',
          className: 'bg-green-600 text-white',
          showButton: false
        };
      case WebSocketStatus.CONNECTING:
        return {
          text: 'Connecting...',
          className: 'bg-yellow-600 text-white',
          showButton: false
        };
      case WebSocketStatus.DISCONNECTED:
        return {
          text: 'Disconnected',
          className: 'bg-red-600 text-white',
          showButton: true
        };
      case WebSocketStatus.ERROR:
        return {
          text: 'Error',
          className: 'bg-red-600 text-white',
          showButton: true
        };
      default:
        return {
          text: 'Unknown',
          className: 'bg-gray-600 text-white',
          showButton: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded px-2 py-0.5 text-xs ${config.className}`}>
        {config.text}
      </span>
      {config.showButton && (
        <button
          onClick={onReconnect}
          className="text-xs text-bsv-primary hover:text-bsv-600 underline"
        >
          Reconnect
        </button>
      )}
    </div>
  );
};

export default WebSocketStatusComponent;