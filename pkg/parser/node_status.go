package parser

// NodeStatusMessage represents a node status update message
type NodeStatusMessage struct {
	Type                 string                 `json:"type"`
	BaseURL              string                 `json:"base_url"`
	PeerID               string                 `json:"peer_id"`
	Version              string                 `json:"version"`
	CommitHash           string                 `json:"commit_hash"`
	BestBlockHash        string                 `json:"best_block_hash"`
	BestHeight           uint32                 `json:"best_height"`
	BlockAssemblyDetails map[string]interface{} `json:"block_assembly_details,omitempty"` // Generic map for JSON storage
	FSMState             string                 `json:"fsm_state"`
	StartTime            int64                  `json:"start_time"`
	Uptime               float64                `json:"uptime"`
	ClientName           string                 `json:"client_name"` // Name of this node client
	MinerName            string                 `json:"miner_name"`  // Name of the miner that mined the best block
	ListenMode           string                 `json:"listen_mode"`
	ChainWork            string                 `json:"chain_work"`                     // Chain work as hex string
	SyncPeerID           string                 `json:"sync_peer_id,omitempty"`         // ID of the peer we're syncing from
	SyncPeerHeight       int32                  `json:"sync_peer_height,omitempty"`     // Height of the sync peer
	SyncPeerBlockHash    string                 `json:"sync_peer_block_hash,omitempty"` // Best block hash of the sync peer
	SyncConnectedAt      int64                  `json:"sync_connected_at,omitempty"`    // Unix timestamp when we first connected to this sync peer
}