import { 
  Message, 
  SearchFilters, 
  ApiResponse, 
  PaginationInfo, 
  MessageStats,
  Network,
  MessageType,
  Block,
  MiningOn,
  Subtree,
  Handshake,
  RejectedTx,
  DashboardFilters
} from '../types/Message';

// Use relative URL when deployed (same origin), or fallback to port 8080 for local development
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' // Empty string means same origin (relative URLs)
  : `http://${window.location.hostname}:8080`;

export class ApiService {
  static async getMessages(filters: SearchFilters = {}): Promise<ApiResponse> {
    const params = new URLSearchParams();
    
    // Set default pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.topic) params.append('topic', filters.topic);
    if (filters.peer) params.append('peer', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const url = `${API_BASE_URL}/api/messages${params.toString() ? `?${params.toString()}` : ''}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data: Message[] = await response.json();
      const messages = data || [];
      
      // Since the backend doesn't provide pagination metadata yet,
      // we'll simulate it based on the response
      const totalItems = messages.length < limit ? offset + messages.length : offset + messages.length + 1;
      const totalPages = Math.ceil(totalItems / limit);
      
      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        pageSize: limit,
        hasNextPage: messages.length === limit,
        hasPreviousPage: page > 1
      };
      
      return {
        messages,
        pagination
      };
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  static async getNetworks(): Promise<Network[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/networks`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching networks:', error);
      // Temporarily only showing mainnet and testnet for mobile UI
      return ['mainnet', 'testnet'];
      // Full list: ['mainnet', 'testnet', 'regtest', 'stn', 'teratestnet', 'tstn'];
    }
  }

  static async getMessageTypes(): Promise<MessageType[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/message-types`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching message types:', error);
      // Temporarily removing 'miningon' from visible message types
      // return ['block', 'miningon', 'subtree', 'handshake', 'rejected_tx'];
      return ['block', 'subtree', 'handshake', 'rejected_tx'];
    }
  }

  static async getBlocks(filters: DashboardFilters): Promise<{ data: Block[], pagination: PaginationInfo }> {
    const params = new URLSearchParams();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.network && filters.network !== 'all') params.append('network', filters.network);
    if (filters.peer) params.append('peer_id', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/blocks?${params.toString()}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    const data: Block[] = await response.json();
    
    return {
      data: data || [],
      pagination: this.createPagination(data?.length || 0, page, limit, offset)
    };
  }

  static async getMiningMessages(filters: DashboardFilters): Promise<{ data: MiningOn[], pagination: PaginationInfo }> {
    const params = new URLSearchParams();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.network && filters.network !== 'all') params.append('network', filters.network);
    if (filters.peer) params.append('peer_id', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/mining?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: MiningOn[] = await response.json();
    
    return {
      data: data || [],
      pagination: this.createPagination(data?.length || 0, page, limit, offset)
    };
  }

  static async getSubtrees(filters: DashboardFilters): Promise<{ data: Subtree[], pagination: PaginationInfo }> {
    const params = new URLSearchParams();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.network && filters.network !== 'all') params.append('network', filters.network);
    if (filters.peer) params.append('peer_id', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/subtrees?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: Subtree[] = await response.json();
    
    return {
      data: data || [],
      pagination: this.createPagination(data?.length || 0, page, limit, offset)
    };
  }

  static async getHandshakes(filters: DashboardFilters): Promise<{ data: Handshake[], pagination: PaginationInfo }> {
    const params = new URLSearchParams();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.network && filters.network !== 'all') params.append('network', filters.network);
    if (filters.peer) params.append('peer_id', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/handshakes?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: Handshake[] = await response.json();
    
    return {
      data: data || [],
      pagination: this.createPagination(data?.length || 0, page, limit, offset)
    };
  }

  static async getRejectedTransactions(filters: DashboardFilters): Promise<{ data: RejectedTx[], pagination: PaginationInfo }> {
    const params = new URLSearchParams();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    if (filters.network && filters.network !== 'all') params.append('network', filters.network);
    if (filters.peer) params.append('peer_id', filters.peer);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());
    
    const response = await fetch(`${API_BASE_URL}/api/rejected-tx?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: RejectedTx[] = await response.json();
    
    return {
      data: data || [],
      pagination: this.createPagination(data?.length || 0, page, limit, offset)
    };
  }

  static async getMessagesByType(filters: DashboardFilters): Promise<{ data: any[], pagination: PaginationInfo }> {
    try {
      if (!filters.messageType || filters.messageType === 'all') {
        // Return generic messages if no specific type, with network filtering
        const searchFilters: SearchFilters = {
          limit: filters.limit,
          page: filters.page,
          peer: filters.peer
        };
        
        // Network filtering is not directly supported by the generic /messages endpoint
        // We'll filter on the frontend for now or use the specific endpoints
        
        const result = await this.getMessages(searchFilters);
        return { data: result.messages, pagination: result.pagination };
      }

      switch (filters.messageType) {
        case 'block':
          return await this.getBlocks(filters);
        // Temporarily disabling miningon message type
        // case 'miningon':
        //   return await this.getMiningMessages(filters);
        case 'subtree':
          return await this.getSubtrees(filters);
        case 'handshake':
          return await this.getHandshakes(filters);
        case 'rejected_tx':
          return await this.getRejectedTransactions(filters);
        default:
          throw new Error(`Unknown message type: ${filters.messageType}`);
      }
    } catch (error) {
      console.error('Error in getMessagesByType:', error);
      throw error;
    }
  }

  private static createPagination(dataLength: number, page: number, limit: number, offset: number): PaginationInfo {
    const totalItems = dataLength < limit ? offset + dataLength : offset + dataLength + 1;
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      currentPage: page,
      totalPages,
      totalItems,
      pageSize: limit,
      hasNextPage: dataLength === limit,
      hasPreviousPage: page > 1
    };
  }

  static async getMessageStats(): Promise<MessageStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const stats = await response.json();
      
      return {
        totalMessages: stats.totalMessages || 0,
        uniqueTopics: stats.uniqueTopics || 0,
        uniquePeers: stats.uniquePeers || 0,
        messagesToday: stats.messagesToday || 0,
        latestBlockHeight: stats.latestBlockHeight || {},
        lastMessageTime: stats.lastMessageTime,
        topicStats: stats.topicStats || [],
        topPeers: stats.topPeers || []
      };
    } catch (error) {
      console.error('Error fetching message stats:', error);
      return {
        totalMessages: 0,
        uniqueTopics: 0,
        uniquePeers: 0,
        messagesToday: 0,
        latestBlockHeight: {},
        topicStats: [],
        topPeers: []
      };
    }
  }

  static async getPeers(page: number = 1, limit: number = 20): Promise<import('../types/Message').PeersResponse> {
    const offset = (page - 1) * limit;
    const response = await fetch(`${API_BASE_URL}/api/peers?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  static async getPeerDetail(peerID: string): Promise<import('../types/Message').PeerDetail> {
    const response = await fetch(`${API_BASE_URL}/api/peers/${encodeURIComponent(peerID)}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }
}