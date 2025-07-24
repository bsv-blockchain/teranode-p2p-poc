import { 
  Message, 
  Block, 
  MiningOn, 
  Subtree, 
  Handshake, 
  RejectedTx
} from '../types/Message';

export class MessageParser {
  static parseWebSocketMessage(message: Message): any {
    try {
      // Extract message type from topic
      const messageType = this.extractMessageType(message.Topic);
      const network = this.extractNetwork(message.Topic);
      
      // Parse the JSON data
      const parsedData = JSON.parse(message.Data);
      
      // Debug logging for handshake messages
      if (messageType === 'handshake') {
        console.log('[MessageParser] Parsing handshake message:', {
          topic: message.Topic,
          messageType,
          network,
          parsedData,
          rawMessage: message
        });
      }
      
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
        
        case 'miningon':
          return this.parseMiningMessage(baseMessage, parsedData);
        
        case 'subtree':
          return this.parseSubtreeMessage(baseMessage, parsedData);
        
        case 'handshake':
          const handshakeResult = this.parseHandshakeMessage(baseMessage, parsedData);
          console.log('[MessageParser] Parsed handshake result:', handshakeResult);
          return handshakeResult;
        
        case 'rejected_tx':
          return this.parseRejectedTxMessage(baseMessage, parsedData);
        
        default:
          // Return the original message for unknown types
          console.warn('[MessageParser] Unknown message type:', messageType, 'from topic:', message.Topic);
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
      Hash: data.hash || data.Hash || '',
      DataHubURL: data.data_hub_url || data.DataHubURL || ''
    };
  }

  private static parseHandshakeMessage(base: any, data: any): Handshake {
    console.log('[MessageParser] Handshake raw data fields:', {
      hasType: 'type' in data,
      hasType_: 'Type' in data,
      hasBestHeight: 'best_height' in data,
      hasBestHeight_: 'BestHeight' in data,
      dataKeys: Object.keys(data)
    });
    
    const result = {
      ...base,
      Type: data.type || data.Type || data.handshake_type || 'unknown',
      BestHeight: data.best_height || data.BestHeight || data.bestHeight || 0,
      BestHash: data.best_hash || data.BestHash || data.bestHash || '',
      DataHubURL: data.data_hub_url || data.DataHubURL || data.dataHubURL || '',
      UserAgent: data.user_agent || data.UserAgent || data.userAgent || 'Unknown',
      Services: data.services || data.Services || 0
    };
    
    console.log('[MessageParser] Handshake parsed result:', result);
    return result;
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

}