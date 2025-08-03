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

export interface TopicStat {
  topic: string;
  messageCount: number;
  network?: string;
  messageType?: string;
}

export interface PeerSummary {
  peerID: string;
  messageCount: number;
  lastSeen: string;
}

export interface MessageStats {
  totalMessages: number;
  uniqueTopics: number;
  uniquePeers: number;
  messagesToday: number;
  latestBlockHeight: Record<string, number>;
  lastMessageTime?: string;
  topicStats: TopicStat[];
  topPeers: PeerSummary[];
}

export interface PeerStat {
  peerID: string;
  totalMessages: number;
  firstSeen: string;
  lastSeen: string;
  networks: string[];
  messageTypes: Record<string, number>;
  lastUserAgent?: string;
  lastBestHeight?: number;
}

export interface PeersResponse {
  peers: PeerStat[];
  totalPeers: number;
  limit: number;
  offset: number;
}

export interface PeerDetail {
  peerID: string;
  totalMessages: number;
  firstSeen: string;
  lastSeen: string;
  networks: string[];
  messageTypes: Record<string, number>;
  handshakes: Handshake[];
  recentBlocks: Block[];
  recentMining: MiningOn[];
  timeStats: {
    hourly?: Record<string, number>;
  };
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
  PeerID: string;  // Peer ID from within the message data
  sentFromPeer?: string;  // Peer who sent this message to us
  Header?: string;  // Hex-encoded block header
  ReceivedAt: string;
  Topic?: string;  // For WebSocket messages
}

export interface BlockHeader {
  ID: number;
  Network: string;
  Hash: string;
  Height: number;
  Version: number;
  PreviousHash: string;
  MerkleRoot: string;
  Timestamp: number;
  Bits: number;
  Nonce: number;
  ReceivedAt: string;
}

export interface MiningOn {
  ID: number;
  Network: string;
  Hash: string;
  PreviousHash: string;
  DataHubURL: string;
  PeerID: string;  // Peer ID from within the message data
  sentFromPeer?: string;  // Peer who sent this message to us
  Height: number;
  Miner: string;
  SizeInBytes: number;
  TxCount: number;
  ReceivedAt: string;
  Topic?: string;  // For WebSocket messages
}

export interface Subtree {
  ID: number;
  Network: string;
  Hash: string;
  DataHubURL: string;
  PeerID: string;  // Peer ID from within the message data
  sentFromPeer?: string;  // Peer who sent this message to us
  ReceivedAt: string;
  Topic?: string;  // For WebSocket messages
}

export interface Handshake {
  ID: number;
  Network: string;
  Type: string;
  PeerID: string;  // Peer ID from within the message data
  sentFromPeer?: string;  // Peer who sent this message to us
  BestHeight: number;
  BestHash: string;
  DataHubURL: string;
  UserAgent: string;
  Services: number;
  ReceivedAt: string;
  Topic?: string;  // For WebSocket messages
}

export interface RejectedTx {
  ID: number;
  Network: string;
  TxID: string;
  Reason: string;
  PeerID: string;  // Peer ID from within the message data
  sentFromPeer?: string;  // Peer who sent this message to us
  ReceivedAt: string;
  Topic?: string;  // For WebSocket messages
}

// Temporarily removing 'miningon' from visible message types
// export type MessageType = 'block' | 'miningon' | 'subtree' | 'handshake' | 'rejected_tx';
export type MessageType = 'block' | 'subtree' | 'handshake' | 'rejected_tx';
export type Network = 'mainnet' | 'testnet' | 'regtest' | 'stn' | 'teratestnet' | 'tstn';

export interface DashboardFilters {
  network: Network | 'all';
  messageType: MessageType | 'all';
  peer?: string;
  limit?: number;
  page?: number;
}