import { ApiService } from './api';
import { 
  DashboardFilters, 
  PaginationInfo,
  Block,
  MiningOn,
  Subtree,
  Handshake,
  RejectedTx
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
      // Fetch from all specialized endpoints in parallel
      const [blocks, mining, subtrees, handshakes, rejectedTx] = await Promise.all([
        this.fetchWithErrorHandling(() => ApiService.getBlocks({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getMiningMessages({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getSubtrees({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getHandshakes({ ...filters, limit: 100, page: 1 })),
        this.fetchWithErrorHandling(() => ApiService.getRejectedTransactions({ ...filters, limit: 100, page: 1 }))
      ]);

      console.log('Fetched data from specialized endpoints:', {
        blocks: blocks?.data?.length || 0,
        mining: mining?.data?.length || 0,
        subtrees: subtrees?.data?.length || 0,
        handshakes: handshakes?.data?.length || 0,
        rejectedTx: rejectedTx?.data?.length || 0
      });


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
            type: 'miningon',
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

      // Transform back to the expected format, but include the message type
      const resultData = paginatedMessages.map(msg => ({
        ...msg.data,
        _messageType: msg.type // Add type info for Dashboard to use
      }));

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
      // Return empty data set if aggregation fails
      return { 
        data: [], 
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          pageSize: filters.limit || 20,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }
  }

  private static async fetchWithErrorHandling<T>(fetchFn: () => Promise<T>): Promise<T | null> {
    try {
      const result = await fetchFn();
      return result;
    } catch (error) {
      // Log more details about which endpoint failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Failed to fetch data:', {
        error: errorMessage,
        functionString: fetchFn.toString().substring(0, 100) + '...'
      });
      return null;
    }
  }

  private static extractNetworkFromTopic(topic: string): string {
    // Extract network from topic like "/mainnet-block" or "bitcoin/testnet-miningon"
    const match = topic.match(/\/([^-]+)-/);
    return match ? match[1] : '';
  }
}