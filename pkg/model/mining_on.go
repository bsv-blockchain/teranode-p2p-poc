package model

import (
	"time"
)

// MiningOn represents a mining announcement message
type MiningOn struct {
	ID           uint      `gorm:"primaryKey"`
	Network      string    `gorm:"index;not null"`
	Hash         string    `gorm:"index;not null"`
	PreviousHash string    `gorm:"index"`
	DataHubURL   string    `gorm:"type:text"`
	PeerID       string    `gorm:"index;not null"`
	Height       uint32    `gorm:"index;not null"`
	Miner        string    `gorm:"index"`
	SizeInBytes  uint64    
	TxCount      uint64    
	ReceivedAt   time.Time `gorm:"index"`
}