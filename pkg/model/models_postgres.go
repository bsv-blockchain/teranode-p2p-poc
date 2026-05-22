package model

import (
	"time"

	"gorm.io/gorm"
)

// PostgreSQL optimized models with batch insert support

// Block represents a block announcement message (PostgreSQL optimized)
type BlockPG struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network    string    `gorm:"type:varchar(20);not null;index:idx_blocks_network_received" json:"Network"`
	Hash       string    `gorm:"type:varchar(64);not null;index:idx_blocks_hash,type:hash" json:"Hash"`
	Height     uint32    `gorm:"not null;index:idx_blocks_height_network" json:"Height"`
	DataHubURL string    `gorm:"type:text" json:"DataHubURL"`
	PeerID     string    `gorm:"type:varchar(100);not null;index:idx_blocks_peer_received" json:"PeerID"`
	Header     string    `gorm:"type:text" json:"Header"`
	ReceivedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_blocks_received_at" json:"ReceivedAt"`
}

func (BlockPG) TableName() string {
	return "blocks"
}

// BlockHeaderPG represents parsed block header data (PostgreSQL optimized)
type BlockHeaderPG struct {
	ID             uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network        string    `gorm:"type:varchar(20);not null;index:idx_blockheaders_network_height" json:"Network"`
	Hash           string    `gorm:"type:varchar(64);not null;index:idx_blockheaders_hash,type:hash" json:"Hash"`
	Height         uint32    `gorm:"not null;index:idx_blockheaders_network_height" json:"Height"`
	Version        int32     `gorm:"not null" json:"Version"`
	PreviousHash   string    `gorm:"type:varchar(64)" json:"PreviousHash"`
	MerkleRoot     string    `gorm:"type:varchar(64);not null" json:"MerkleRoot"`
	Timestamp      uint32    `gorm:"not null;index:idx_blockheaders_timestamp" json:"Timestamp"`
	Bits           uint32    `gorm:"not null" json:"Bits"`
	Nonce          uint64    `gorm:"not null" json:"Nonce"`
	ReceivedAt     time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"ReceivedAt"`
	CoinbaseValue  uint64    `gorm:"default:0" json:"CoinbaseValue"`
	CoinbaseScript string    `gorm:"type:text" json:"CoinbaseScript"`
	MinerAddress   string    `gorm:"type:varchar(100);index:idx_blockheaders_miner" json:"MinerAddress"`
	CoinbaseTxID   string    `gorm:"type:varchar(64)" json:"CoinbaseTxID"`
	CoinbaseText   string    `gorm:"type:text" json:"CoinbaseText"`
}

func (BlockHeaderPG) TableName() string {
	return "block_headers"
}

// HandshakePG represents a handshake message (PostgreSQL optimized)
type HandshakePG struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network    string    `gorm:"type:varchar(20);not null;index:idx_handshakes_network_received" json:"Network"`
	Type       string    `gorm:"type:varchar(20);not null" json:"Type"`
	PeerID     string    `gorm:"type:varchar(100);not null;index:idx_handshakes_peer_received;index:idx_handshakes_peer_network" json:"PeerID"`
	BestHeight uint32    `gorm:"not null" json:"BestHeight"`
	BestHash   string    `gorm:"type:varchar(64);not null" json:"BestHash"`
	DataHubURL string    `gorm:"type:text" json:"DataHubURL"`
	UserAgent  string    `gorm:"type:text" json:"UserAgent"`
	Services   uint64    `gorm:"not null" json:"Services"`
	ReceivedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"ReceivedAt"`
}

func (HandshakePG) TableName() string {
	return "handshakes"
}

// MiningOnPG represents a mining_on message (PostgreSQL optimized)
type MiningOnPG struct {
	ID           uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network      string    `gorm:"type:varchar(20);not null;index:idx_miningons_network_received" json:"Network"`
	Hash         string    `gorm:"type:varchar(64);not null" json:"Hash"`
	PreviousHash string    `gorm:"type:varchar(64);not null" json:"PreviousHash"`
	DataHubURL   string    `gorm:"type:text" json:"DataHubURL"`
	PeerID       string    `gorm:"type:varchar(100);not null;index:idx_miningons_peer_received" json:"PeerID"`
	Height       uint32    `gorm:"not null" json:"Height"`
	Miner        string    `gorm:"type:varchar(100);index:idx_miningons_miner" json:"Miner"`
	SizeInBytes  uint64    `gorm:"not null" json:"SizeInBytes"`
	TxCount      uint64    `gorm:"not null" json:"TxCount"`
	ReceivedAt   time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"ReceivedAt"`
}

func (MiningOnPG) TableName() string {
	return "mining_ons"
}

// SubtreePG represents a subtree message (PostgreSQL optimized)
type SubtreePG struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network    string    `gorm:"type:varchar(20);not null;index:idx_subtrees_network_received" json:"Network"`
	Hash       string    `gorm:"type:varchar(64);not null;index:idx_subtrees_hash,type:hash" json:"Hash"`
	DataHubURL string    `gorm:"type:text" json:"DataHubURL"`
	PeerID     string    `gorm:"type:varchar(100);not null;index:idx_subtrees_peer_received" json:"PeerID"`
	ReceivedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"ReceivedAt"`
}

func (SubtreePG) TableName() string {
	return "subtrees"
}

// BestBlockRequestPG represents a best block request (PostgreSQL optimized)
type BestBlockRequestPG struct {
	ID         uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network    string    `gorm:"type:varchar(20);not null;index:idx_bestblock_network_received" json:"Network"`
	PeerID     string    `gorm:"type:varchar(100);not null;index:idx_bestblock_peer_received" json:"PeerID"`
	ReceivedAt time.Time `gorm:"not null;default:CURRENT_TIMESTAMP" json:"ReceivedAt"`
}

func (BestBlockRequestPG) TableName() string {
	return "best_block_requests"
}

// StatsCachePG for storing pre-calculated statistics (PostgreSQL optimized)
type StatsCachePG struct {
	ID                  uint64     `gorm:"primaryKey;autoIncrement" json:"id"`
	CalculatedAt        time.Time  `gorm:"not null;index:idx_stats_cache_calculated" json:"calculated_at"`
	TotalMessages       int64      `gorm:"not null;default:0" json:"total_messages"`
	MessagesToday       int64      `gorm:"not null;default:0" json:"messages_today"`
	UniqueTopics        int        `gorm:"not null;default:0" json:"unique_topics"`
	UniquePeers         int        `gorm:"not null;default:0" json:"unique_peers"`
	MessageCountByTable string     `gorm:"type:jsonb" json:"message_count_by_table"`
	TopicStats          string     `gorm:"type:jsonb" json:"topic_stats"`
	NetworkActivity     string     `gorm:"type:jsonb" json:"network_activity"`
	LatestBlockHeights  string     `gorm:"type:jsonb" json:"latest_block_heights"`
	TopPeers            string     `gorm:"type:jsonb" json:"top_peers"`
	LastMessageTime     *time.Time `json:"last_message_time"`
	CalculationTimeMs   int64      `gorm:"not null;default:0" json:"calculation_time_ms"`
}

func (StatsCachePG) TableName() string {
	return "stats_caches"
}

// NodeStatusPG represents a node status message (PostgreSQL optimized)
type NodeStatusPG struct {
	ID                   uint64    `gorm:"primaryKey;autoIncrement" json:"ID"`
	Network              string    `gorm:"type:varchar(20);not null;index:idx_nodestatus_network_received" json:"Network"`
	Type                 string    `gorm:"type:varchar(20);not null" json:"Type"`
	BaseURL              string    `gorm:"type:text" json:"BaseURL"`
	PeerID               string    `gorm:"type:varchar(100);not null;index:idx_nodestatus_peer_received" json:"PeerID"`
	Version              string    `gorm:"type:varchar(50)" json:"Version"`
	CommitHash           string    `gorm:"type:varchar(64)" json:"CommitHash"`
	BestBlockHash        string    `gorm:"type:varchar(64);not null" json:"BestBlockHash"`
	BestHeight           uint32    `gorm:"not null;index:idx_nodestatus_height" json:"BestHeight"`
	BlockAssemblyDetails string    `gorm:"type:jsonb" json:"BlockAssemblyDetails"` // JSON storage for complex struct
	FSMState             string    `gorm:"type:varchar(50)" json:"FSMState"`
	StartTime            int64     `gorm:"not null" json:"StartTime"`
	Uptime               float64   `gorm:"not null" json:"Uptime"`
	ClientName           string    `gorm:"type:varchar(100)" json:"ClientName"`
	MinerName            string    `gorm:"type:varchar(100);index:idx_nodestatus_miner" json:"MinerName"`
	ListenMode           string    `gorm:"type:varchar(50)" json:"ListenMode"`
	ChainWork            string    `gorm:"type:text" json:"ChainWork"`
	SyncPeerID           string    `gorm:"type:varchar(100)" json:"SyncPeerID"`
	SyncPeerHeight       int32     `gorm:"default:0" json:"SyncPeerHeight"`
	SyncPeerBlockHash    string    `gorm:"type:varchar(64)" json:"SyncPeerBlockHash"`
	SyncConnectedAt      int64     `gorm:"default:0" json:"SyncConnectedAt"`
	ReceivedAt           time.Time `gorm:"not null;default:CURRENT_TIMESTAMP;index:idx_nodestatus_received_at" json:"ReceivedAt"`
}

func (NodeStatusPG) TableName() string {
	return "node_statuses"
}

// MigratePostgreSQL runs the optimized PostgreSQL schema migration
func MigratePostgreSQL(db *gorm.DB) error {
	// Note: The actual schema creation should be done via the SQL migration file
	// This is just for GORM compatibility
	return nil
}
