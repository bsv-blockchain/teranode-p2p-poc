export interface Message {
  ID: number;
  Topic: string;
  Data: string;
  Peer: string;
  ReceivedAt: string;
}

export interface SearchFilters {
  topic?: string;
  peer?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse {
  messages: Message[];
  pagination: PaginationInfo;
}

export interface MessageStats {
  totalMessages: number;
  uniqueTopics: number;
  uniquePeers: number;
  messagesPerMinute: number;
  lastMessageTime?: string;
}

export enum WebSocketStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}