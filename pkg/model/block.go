package model

import (
	"time"
)

// Block represents a block announcement message
type Block struct {
	ID         uint      `gorm:"primaryKey" json:"ID"`
	Network    string    `gorm:"index;not null" json:"Network"`
	Hash       string    `gorm:"index;not null" json:"Hash"`
	Height     uint32    `gorm:"index;not null" json:"Height"`
	DataHubURL string    `gorm:"type:text" json:"DataHubURL"`
	PeerID     string    `gorm:"index;not null" json:"PeerID"`
	Header     string    `gorm:"type:text" json:"Header"`
	ReceivedAt time.Time `gorm:"index" json:"ReceivedAt"`
}

type BlockHeader struct {
	ID             uint      `gorm:"primaryKey" json:"ID"`
	Network        string    `gorm:"index;not null" json:"Network"`
	Hash           string    `gorm:"index;not null" json:"Hash"`
	Height         uint32    `gorm:"index;not null" json:"Height"`
	Version        int32     `gorm:"not null" json:"Version"`
	PreviousHash   string    `gorm:"index" json:"PreviousHash"`
	MerkleRoot     string    `gorm:"not null" json:"MerkleRoot"`
	Timestamp      uint32    `gorm:"index;not null" json:"Timestamp"` // Unix timestamp
	Bits           uint32    `gorm:"not null" json:"Bits"`             // Difficulty target
	Nonce          uint32    `gorm:"not null" json:"Nonce"`
	ReceivedAt     time.Time `gorm:"index;not null" json:"ReceivedAt"`
	// Coinbase transaction fields
	CoinbaseValue  uint64    `gorm:"default:0" json:"CoinbaseValue"`           // Total output value in satoshis
	CoinbaseScript string    `gorm:"type:text" json:"CoinbaseScript"`          // Hex-encoded coinbase script
	MinerAddress   string    `gorm:"index" json:"MinerAddress"`                // Miner address if identifiable
	CoinbaseTxID   string    `gorm:"index" json:"CoinbaseTxID"`                // Coinbase transaction ID
	CoinbaseText   string    `gorm:"type:text" json:"CoinbaseText"`            // Decoded ASCII text from coinbase
}
