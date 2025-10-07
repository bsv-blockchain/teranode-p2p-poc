import { NodeStatus, Network } from '../types/Message';

export interface NodeStatusWithScore extends NodeStatus {
  chainworkScore?: number;
  maxChainworkScore?: number;
}

class NodeStatusStore {
  private nodeStatuses: Map<string, Map<string, NodeStatusWithScore>> = new Map();
  private listeners: Set<(network: Network, statuses: NodeStatusWithScore[]) => void> = new Set();

  constructor() {
    // Initialize maps for each network
    const networks: Network[] = ['mainnet', 'testnet', 'teratestnet', 'tstn'];
    networks.forEach(network => {
      this.nodeStatuses.set(network, new Map());
    });
  }

  // Add or update a node status
  updateNodeStatus(status: NodeStatus) {
    const network = status.Network as Network;
    const networkMap = this.nodeStatuses.get(network);

    if (!networkMap) {
      this.nodeStatuses.set(network, new Map());
    }

    const map = this.nodeStatuses.get(network)!;

    // Only update if this is newer than what we have
    const existing = map.get(status.PeerID);
    if (!existing || new Date(status.ReceivedAt) > new Date(existing.ReceivedAt)) {
      // Preserve the existing object reference but update its properties
      // This helps React maintain stable references
      if (existing) {
        Object.assign(existing, status);
      } else {
        map.set(status.PeerID, status as NodeStatusWithScore);
      }
      this.recalculateChainworkScores(network);
      this.notifyListeners(network);
    }
  }

  // Calculate chainwork scores for all nodes in a network
  private recalculateChainworkScores(network: Network) {
    const networkMap = this.nodeStatuses.get(network);
    if (!networkMap) return;

    const nodes = Array.from(networkMap.values());

    // Collect unique chainwork values
    const chainworkSet = new Set<string>();
    nodes.forEach(node => {
      if (node.ChainWork && node.ChainWork.length > 0) {
        chainworkSet.add(node.ChainWork);
      }
    });

    // Sort chainwork values (treating as hex strings)
    const sortedChainworks = Array.from(chainworkSet).sort((a, b) => {
      if (a.length !== b.length) {
        return a.length - b.length;
      }
      return a.localeCompare(b);
    });

    // Create chainwork to score mapping
    const chainworkToScore = new Map<string, number>();
    sortedChainworks.forEach((chainwork, index) => {
      chainworkToScore.set(chainwork, index + 1);
    });

    const maxScore = sortedChainworks.length;

    // Assign scores to nodes
    nodes.forEach(node => {
      if (node.ChainWork && chainworkToScore.has(node.ChainWork)) {
        node.chainworkScore = chainworkToScore.get(node.ChainWork)!;
        node.maxChainworkScore = maxScore;
      } else {
        node.chainworkScore = 0;
        node.maxChainworkScore = maxScore;
      }
    });
  }

  // Get all node statuses for a network
  getNodeStatuses(network: Network): NodeStatusWithScore[] {
    const networkMap = this.nodeStatuses.get(network);
    if (!networkMap) return [];

    return Array.from(networkMap.values())
      .sort((a, b) => {
        // Sort by best height descending, then by received time
        if (a.BestHeight !== b.BestHeight) {
          return b.BestHeight - a.BestHeight;
        }
        return new Date(b.ReceivedAt).getTime() - new Date(a.ReceivedAt).getTime();
      });
  }

  // Clear all statuses for a network
  clearNetwork(network: Network) {
    const networkMap = this.nodeStatuses.get(network);
    if (networkMap) {
      networkMap.clear();
      this.notifyListeners(network);
    }
  }

  // Subscribe to changes
  subscribe(listener: (network: Network, statuses: NodeStatusWithScore[]) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners of changes
  private notifyListeners(network: Network) {
    const statuses = this.getNodeStatuses(network);
    this.listeners.forEach(listener => {
      listener(network, statuses);
    });
  }

  // Batch update from API
  setNodeStatuses(network: Network, statuses: NodeStatus[]) {
    const networkMap = this.nodeStatuses.get(network);
    if (!networkMap) {
      this.nodeStatuses.set(network, new Map());
    }

    const map = this.nodeStatuses.get(network)!;
    map.clear();

    // Group by peer ID and keep only the latest
    const latestByPeer = new Map<string, NodeStatus>();
    statuses.forEach(status => {
      const existing = latestByPeer.get(status.PeerID);
      if (!existing || new Date(status.ReceivedAt) > new Date(existing.ReceivedAt)) {
        latestByPeer.set(status.PeerID, status);
      }
    });

    // Add to store
    latestByPeer.forEach((status, peerID) => {
      map.set(peerID, status as NodeStatusWithScore);
    });

    this.recalculateChainworkScores(network);
    this.notifyListeners(network);
  }
}

// Export singleton instance
export const nodeStatusStore = new NodeStatusStore();