import {
  Message,
  Block,
  MiningOn,
  Subtree,
  Handshake,
  NodeStatus
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
        sentFromPeer: message.Peer,  // The peer who sent this message to us
        Topic: message.Topic
      };

      // Parse based on message type
      switch (messageType) {
        case 'block':
          return this.parseBlockMessage(baseMessage, parsedData);
        
        // Temporarily disabled miningon messages
        // case 'miningon':
        //   return this.parseMiningMessage(baseMessage, parsedData);
        
        case 'subtree':
          return this.parseSubtreeMessage(baseMessage, parsedData);
        
        case 'handshake':
          return this.parseHandshakeMessage(baseMessage, parsedData);

        case 'node_status':
          return this.parseNodeStatusMessage(baseMessage, parsedData);

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
      PeerID: data.peer_id || data.PeerID || data.peerId || base.sentFromPeer || '',  // Try to get peer ID from data, fallback to sender
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
      PeerID: data.peer_id || data.PeerID || data.peerId || base.sentFromPeer || '',  // Try to get peer ID from data, fallback to sender
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
      PeerID: data.peer_id || data.PeerID || data.peerId || base.sentFromPeer || '',  // Try to get peer ID from data, fallback to sender
      Hash: data.hash || data.Hash || '',
      DataHubURL: data.data_hub_url || data.DataHubURL || ''
    };
  }

  private static parseHandshakeMessage(base: any, data: any): Handshake {
    return {
      ...base,
      PeerID: data.peer_id || data.PeerID || data.peerId || base.sentFromPeer || '',  // Try to get peer ID from data, fallback to sender
      Type: data.type || data.Type || data.handshake_type || 'unknown',
      BestHeight: data.best_height || data.BestHeight || data.bestHeight || 0,
      BestHash: data.best_hash || data.BestHash || data.bestHash || '',
      DataHubURL: data.data_hub_url || data.DataHubURL || data.dataHubURL || '',
      UserAgent: data.user_agent || data.UserAgent || data.userAgent || 'Unknown',
      Services: data.services || data.Services || 0
    };
  }

  private static parseNodeStatusMessage(base: any, data: any): NodeStatus {
    return {
      ...base,
      PeerID: data.peer_id || data.PeerID || data.peerId || base.sentFromPeer || '',
      Type: data.type || data.Type || '',
      BaseURL: data.base_url || data.BaseURL || data.baseUrl || '',
      Version: data.version || data.Version || '',
      CommitHash: data.commit_hash || data.CommitHash || data.commitHash || '',
      BestBlockHash: data.best_block_hash || data.BestBlockHash || data.bestBlockHash || '',
      BestHeight: data.best_height || data.BestHeight || data.bestHeight || 0,
      BlockAssemblyDetails: data.block_assembly_details || data.BlockAssemblyDetails || data.blockAssemblyDetails || null,
      FSMState: data.fsm_state || data.FSMState || data.fsmState || '',
      StartTime: data.start_time || data.StartTime || data.startTime || 0,
      Uptime: data.uptime || data.Uptime || 0,
      ClientName: data.client_name || data.ClientName || data.clientName || '',
      MinerName: data.miner_name || data.MinerName || data.minerName || '',
      ListenMode: data.listen_mode || data.ListenMode || data.listenMode || '',
      ChainWork: data.chain_work || data.ChainWork || data.chainWork || '',
      SyncPeerID: data.sync_peer_id || data.SyncPeerID || data.syncPeerId,
      SyncPeerHeight: data.sync_peer_height || data.SyncPeerHeight || data.syncPeerHeight,
      SyncPeerBlockHash: data.sync_peer_block_hash || data.SyncPeerBlockHash || data.syncPeerBlockHash,
      SyncConnectedAt: data.sync_connected_at || data.SyncConnectedAt || data.syncConnectedAt,
      MinMiningTxFee: data.min_mining_tx_fee || data.MinMiningTxFee || data.minMiningTxFee
    };
  }

}