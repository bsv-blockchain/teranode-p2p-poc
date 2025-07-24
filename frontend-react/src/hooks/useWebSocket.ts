import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, WebSocketStatus } from '../types/Message';

// Use relative WebSocket URL when deployed, or fallback to port 8080 for local development
const WS_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws`
  : `ws://${window.location.hostname}:8080/api/ws`;

export const useWebSocket = (onMessage: (message: Message) => void) => {
  const [status, setStatus] = useState<WebSocketStatus>(WebSocketStatus.CONNECTING);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setStatus(WebSocketStatus.CONNECTING);
    
    try {
      const ws = new WebSocket(WS_URL);
      
      ws.onopen = () => {
        setStatus(WebSocketStatus.CONNECTED);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        try {
          const message: Message = JSON.parse(event.data);
          onMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setStatus(WebSocketStatus.DISCONNECTED);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        setStatus(WebSocketStatus.ERROR);
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      setStatus(WebSocketStatus.ERROR);
      console.error('Failed to create WebSocket connection:', error);
    }
  }, [onMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setStatus(WebSocketStatus.DISCONNECTED);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { status, reconnect };
};