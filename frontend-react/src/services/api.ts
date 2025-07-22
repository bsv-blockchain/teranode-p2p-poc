import { Message, SearchFilters, ApiResponse, PaginationInfo, MessageStats } from '../types/Message';

const API_BASE_URL = `http://${window.location.hostname}:8080`;

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
    
    const url = `${API_BASE_URL}/messages${params.toString() ? `?${params.toString()}` : ''}`;
    
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

  static async getMessageStats(): Promise<MessageStats> {
    try {
      // Get recent messages to calculate stats
      const response = await this.getMessages({ limit: 100 });
      const messages = response.messages;
      
      const uniqueTopics = new Set(messages.map(m => m.Topic)).size;
      const uniquePeers = new Set(messages.map(m => m.Peer)).size;
      
      // Calculate messages per minute based on recent messages
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const recentMessages = messages.filter(m => 
        new Date(m.ReceivedAt) > oneMinuteAgo
      );
      
      const lastMessageTime = messages.length > 0 ? messages[0].ReceivedAt : undefined;
      
      return {
        totalMessages: response.pagination.totalItems,
        uniqueTopics,
        uniquePeers,
        messagesPerMinute: recentMessages.length,
        lastMessageTime
      };
    } catch (error) {
      console.error('Error fetching message stats:', error);
      return {
        totalMessages: 0,
        uniqueTopics: 0,
        uniquePeers: 0,
        messagesPerMinute: 0
      };
    }
  }
}