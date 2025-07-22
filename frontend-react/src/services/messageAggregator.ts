import { ApiService } from './api';
import { 
  DashboardFilters, 
  PaginationInfo,
  Block,
  MiningOn,
  Subtree,
  Handshake,
  RejectedTx,
  Message
} from '../types/Message';

interface AggregatedMessage {
  data: any;
  type: string;
  sortKey: string; // ReceivedAt timestamp for sorting
}

export class MessageAggregatorService {
  static async getAllMessages(filters: DashboardFilters): Promise<{ data: any[], pagination: PaginationInfo }> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    try {
      // First, fetch generic messages to get all available data
      const genericMessages = await this.fetchWithErrorHandling(() => 
        ApiService.getMessages({ limit: 200, page: 1, peer: filters.peer })
      );

      // If we have generic messages, parse them all
      if (genericMessages?.messages && genericMessages.messages.length > 0) {
        // Import parser
        const { MessageParser } = await import('../utils/messageParser');
        
        // Parse all messages and return them
        const parsedMessages = genericMessages.messages.map((msg: Message) => {
          const parsedData = MessageParser.parseWebSocketMessage(msg);
          return parsedData;
        });

        // Filter by network if specified
        let filteredMessages = parsedMessages;
        if (filters.network && filters.network !== 'all') {
          filteredMessages = parsedMessages.filter((msg: any) => {
            const network = msg.Network || this.extractNetworkFromTopic(msg.Topic);
            return network === filters.network;
          });
        }

        // Sort by ReceivedAt (newest first)
        filteredMessages.sort((a: any, b: any) => {
          return new Date(b.ReceivedAt).getTime() - new Date(a.ReceivedAt).getTime();
        });

        // Apply pagination
        const paginatedMessages = filteredMessages.slice(offset, offset + limit);
        const totalItems = filteredMessages.length;
        const totalPages = Math.ceil(totalItems / limit);

        const pagination: PaginationInfo = {
          currentPage: page,
          totalPages,
          totalItems,
          pageSize: limit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        };

        return { data: paginatedMessages, pagination };
      }

      // Fallback: try specialized endpoints if generic messages failed
      const [blocks, mining, subtrees, handshakes, rejectedTx] = await Promise.all([
        this.fetchWithErrorHandling(() => ApiService.getBlocks({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getMiningMessages({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getSubtrees({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getHandshakes({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getRejectedTransactions({ ...filters, limit: 100, page: 1 }))
      ]);

      // Aggregate all messages
      const aggregatedMessages: AggregatedMessage[] = [];

      // Add blocks
      if (blocks?.data) {
        blocks.data.forEach((block: Block) => {
          aggregatedMessages.push({
            data: block,
            type: 'block',
            sortKey: block.ReceivedAt
          });
        });
      }

      // Add mining messages
      if (mining?.data) {
        mining.data.forEach((miningMsg: MiningOn) => {
          aggregatedMessages.push({
            data: miningMsg,
            type: 'mining_on',
            sortKey: miningMsg.ReceivedAt
          });
        });
      }

      // Add subtrees
      if (subtrees?.data) {
        subtrees.data.forEach((subtree: Subtree) => {
          aggregatedMessages.push({
            data: subtree,
            type: 'subtree',
            sortKey: subtree.ReceivedAt
          });
        });
      }

      // Add handshakes
      if (handshakes?.data) {
        handshakes.data.forEach((handshake: Handshake) => {
          aggregatedMessages.push({
            data: handshake,
            type: 'handshake',
            sortKey: handshake.ReceivedAt
          });
        });
      }

      // Add rejected transactions
      if (rejectedTx?.data) {
        rejectedTx.data.forEach((tx: RejectedTx) => {
          aggregatedMessages.push({
            data: tx,
            type: 'rejected_tx',
            sortKey: tx.ReceivedAt
          });
        });
      }

      // Process generic messages for bestblock and other types
      if (genericMessages?.messages) {
        const { MessageParser } = await import('../utils/messageParser');
        
        genericMessages.messages.forEach((msg: Message) => {
          // Extract message type from topic
          const topicParts = msg.Topic.split('-');
          const messageType = topicParts[topicParts.length - 1];
          
          // Check if this message type is not already handled by specialized endpoints
          const isSpecializedType = ['block', 'mining_on', 'subtree', 'handshake', 'rejected_tx'].includes(messageType);
          
          if (!isSpecializedType) {
            // Don't duplicate if we already have this message
            const isDuplicate = aggregatedMessages.some(am => 
              am.sortKey === msg.ReceivedAt && am.data.Peer === msg.Peer
            );
            
            if (!isDuplicate) {
              // Parse the message to get structured data
              const parsedMessage = MessageParser.parseWebSocketMessage(msg);
              
              aggregatedMessages.push({
                data: parsedMessage,
                type: messageType,
                sortKey: msg.ReceivedAt
              });
            }
          }
        });
      }

      // Filter by network if specified
      let filteredMessages = aggregatedMessages;
      if (filters.network && filters.network !== 'all') {
        filteredMessages = aggregatedMessages.filter(msg => {
          // Extract network from the data or topic
          const network = msg.data.Network || this.extractNetworkFromTopic(msg.data.Topic);
          return network === filters.network;
        });
      }

      // Sort by ReceivedAt (newest first)
      filteredMessages.sort((a, b) => {
        return new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime();
      });

      // Apply pagination
      const paginatedMessages = filteredMessages.slice(offset, offset + limit);
      const totalItems = filteredMessages.length;
      const totalPages = Math.ceil(totalItems / limit);

      // Transform back to the expected format
      const resultData = paginatedMessages.map(msg => msg.data);

      const pagination: PaginationInfo = {
        currentPage: page,
        totalPages,
        totalItems,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      };

      return { data: resultData, pagination };

    } catch (error) {
      console.error('Error in message aggregator:', error);
      // Fall back to generic messages endpoint
      const result = await ApiService.getMessages({
        limit: filters.limit,
        page: filters.page,
        peer: filters.peer
      });
      return { data: result.messages, pagination: result.pagination };
    }
  }

  private static async fetchWithErrorHandling<T>(fetchFn: () => Promise<T>): Promise<T | null> {
    try {
      return await fetchFn();
    } catch (error) {
      console.warn('Failed to fetch data:', error);
      return null;
    }
  }

  private static extractNetworkFromTopic(topic: string): string {
    // Extract network from topic like "/mainnet-block" or "bitcoin/testnet-mining_on"
    const match = topic.match(/\/([^-]+)-/);
    return match ? match[1] : '';
  }
}