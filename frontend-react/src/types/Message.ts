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
  network?: string;
  messageType?: string;
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

// Message type definitions matching the backend
export interface Block {
  ID: number;
  Network: string;
  Hash: string;
  Height: number;
  DataHubURL: string;
  PeerID: string;
  ReceivedAt: string;
}

export interface MiningOn {
  ID: number;
  Network: string;
  Hash: string;
  PreviousHash: string;
  DataHubURL: string;
  PeerID: string;
  Height: number;
  Miner: string;
  SizeInBytes: number;
  TxCount: number;
  ReceivedAt: string;
}

export interface Subtree {
  ID: number;
  Network: string;
  Hash: string;
  DataHubURL: string;
  PeerID: string;
  ReceivedAt: string;
}

export interface Handshake {
  ID: number;
  Network: string;
  Type: string;
  PeerID: string;
  BestHeight: number;
  BestHash: string;
  DataHubURL: string;
  UserAgent: string;
  Services: number;
  ReceivedAt: string;
}

export interface RejectedTx {
  ID: number;
  Network: string;
  TxID: string;
  Reason: string;
  PeerID: string;
  ReceivedAt: string;
}

export type MessageType = 'block' | 'mining_on' | 'subtree' | 'handshake' | 'rejected_tx';
export type Network = 'mainnet' | 'testnet' | 'regtest' | 'stn' | 'teratestnet' | 'tstn';

export interface DashboardFilters {
  network: Network | 'all';
  messageType: MessageType | 'all';
  peer?: string;
  limit?: number;
  page?: number;
}