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
	ReceivedAt time.Time `json:"ReceivedAt"`
}

type BlockHeader struct {
	ID           uint      `gorm:"primaryKey" json:"ID"`
	Network      string    `gorm:"index;not null" json:"Network"`
	Hash         string    `gorm:"index;not null" json:"Hash"`
	Height       uint32    `gorm:"index;not null" json:"Height"`
	Version      int32     `gorm:"not null" json:"Version"`
	PreviousHash string    `gorm:"index" json:"PreviousHash"`
	MerkleRoot   string    `gorm:"not null" json:"MerkleRoot"`
	Timestamp    uint32    `gorm:"index;not null" json:"Timestamp"` // Unix timestamp
	Bits         uint32    `gorm:"not null" json:"Bits"`             // Difficulty target
	Nonce        uint32    `gorm:"not null" json:"Nonce"`
	ReceivedAt   time.Time `gorm:"index;not null" json:"ReceivedAt"`
}
