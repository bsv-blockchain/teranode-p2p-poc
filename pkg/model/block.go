package model

import (
	"time"
)

// Block represents a block announcement message
type Block struct {
	ID         uint   `gorm:"primaryKey"`
	Network    string `gorm:"index;not null"`
	Hash       string `gorm:"index;not null"`
	Height     uint32 `gorm:"index;not null"`
	DataHubURL string `gorm:"type:text"`
	PeerID     string `gorm:"index;not null"`
	Header     string `gorm:"type:text"`
	ReceivedAt time.Time
}

type BlockHeader struct {
	ID           uint   `gorm:"primaryKey"`
	Hash         string `gorm:"index;not null"`
	Height       uint32 `gorm:"index;not null"`
	PreviousHash string `gorm:"index"`
	Coinbase     string `gorm:"type:text"`
	Timestamp    int64  `gorm:"index;not null"` // Unix timestamp
	MerkleRoot   string `gorm:"index;not null"`
	Nonce        uint64 `gorm:"index;not null"`
	Bits         uint32 `gorm:"index;not null"` // Difficulty target
	SizeInBytes  uint64 `gorm:"index;not null"` // Size of the block header in bytes
	Transactions uint64 `gorm:"index;not null"` // Number of transactions in the block
}
