import { 
  Message, 
  Block, 
  MiningOn, 
  Subtree, 
  Handshake, 
  RejectedTx, 
  BestBlockRequest 
} from '../types/Message';

export class MessageParser {
  static parseWebSocketMessage(message: Message): any {
    try {
      // Extract message type from topic
      const messageType = this.extractMessageType(message.Topic);
      const network = this.extractNetwork(message.Topic);
      
      // Parse the JSON data
      const parsedData = JSON.parse(message.Data);
      
      // Create a base object with common fields
      const baseMessage = {
        ID: message.ID,
        ReceivedAt: message.ReceivedAt,
        Network: network,
        PeerID: message.Peer,
        Peer: message.Peer,
        Topic: message.Topic
      };

      // Parse based on message type
      switch (messageType) {
        case 'block':
          return this.parseBlockMessage(baseMessage, parsedData);
        
        case 'mining_on':
          return this.parseMiningMessage(baseMessage, parsedData);
        
        case 'subtree':
          return this.parseSubtreeMessage(baseMessage, parsedData);
        
        case 'handshake':
          return this.parseHandshakeMessage(baseMessage, parsedData);
        
        case 'rejected_tx':
          return this.parseRejectedTxMessage(baseMessage, parsedData);
        
        case 'bestblock':
          return this.parseBestBlockMessage(baseMessage, parsedData);
        
        default:
          // Return the original message for unknown types
          return message;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
      return message;
    }
  }

  private static extractMessageType(topic: string): string {
    const parts = topic.split('-');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private static extractNetwork(topic: string): string {
    const match = topic.match(/\/([^-]+)-/);
    return match ? match[1] : '';
  }

  private static parseBlockMessage(base: any, data: any): Block {
    return {
      ...base,
      Hash: data.hash || data.Hash || '',
      Height: data.height || data.Height || 0,
      DataHubURL: data.data_hub_url || data.DataHubURL || '',
      Size: data.size || data.Size || 0,
      TxCount: data.tx_count || data.TxCount || 0
    };
  }

  private static parseMiningMessage(base: any, data: any): MiningOn {
    return {
      ...base,
      Hash: data.hash || data.Hash || '',
      PreviousHash: data.previous_hash || data.PreviousHash || '',
      Height: data.height || data.Height || 0,
      Miner: data.miner || data.Miner || '',
      SizeInBytes: data.size_in_bytes || data.SizeInBytes || 0,
      TxCount: data.tx_count || data.TxCount || 0,
      DataHubURL: data.data_hub_url || data.DataHubURL || ''
    };
  }

  private static parseSubtreeMessage(base: any, data: any): Subtree {
    return {
      ...base,
      ReorgLimit: data.reorg_limit || data.ReorgLimit || 0,
      NodeType: data.node_type || data.NodeType || '',
      BlockHash: data.block_hash || data.BlockHash || '',
      MerkleRoot: data.merkle_root || data.MerkleRoot || '',
      StartIdx: data.start_idx || data.StartIdx || 0,
      TxCount: data.tx_count || data.TxCount || 0,
      MerklePaths: data.merkle_paths || data.MerklePaths || []
    };
  }

  private static parseHandshakeMessage(base: any, data: any): Handshake {
    return {
      ...base,
      Version: data.version || data.Version || '',
      UserAgent: data.user_agent || data.UserAgent || '',
      StreamPolicies: data.stream_policies || data.StreamPolicies || [],
      StartHeight: data.start_height || data.StartHeight || 0,
      StartHash: data.start_hash || data.StartHash || '',
      Relay: data.relay || data.Relay || false,
      Services: data.services || data.Services || '',
      Timestamp: data.timestamp || data.Timestamp || 0,
      ReceiverServices: data.receiver_services || data.ReceiverServices || '',
      ReceiverAddr: data.receiver_addr || data.ReceiverAddr || '',
      SenderServices: data.sender_services || data.SenderServices || '',
      SenderAddr: data.sender_addr || data.SenderAddr || '',
      Nonce: data.nonce || data.Nonce || 0
    };
  }

  private static parseRejectedTxMessage(base: any, data: any): RejectedTx {
    return {
      ...base,
      TxID: data.tx_id || data.TxID || '',
      Reason: data.reason || data.Reason || '',
      Code: data.code || data.Code || 0,
      Data: data.data || data.Data || '',
      ExtraInfo: data.extra_info || data.ExtraInfo || ''
    };
  }

  private static parseBestBlockMessage(base: any, data: any): BestBlockRequest {
    return {
      ...base,
      Hash: data.hash || data.Hash || '',
      Height: data.height || data.Height || 0,
      ChainWork: data.chain_work || data.ChainWork || '',
      MedianTimePast: data.median_time_past || data.MedianTimePast || 0
    };
  }
}