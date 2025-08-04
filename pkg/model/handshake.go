package model

import (
	"time"
)

// Handshake represents a handshake message between peers
type Handshake struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	Type       string    `gorm:"index;not null"` // "version" or "verack"
	PeerID     string    `gorm:"index;not null"`
	BestHeight uint32    `gorm:"index"`
	BestHash   string    `gorm:"index"`
	DataHubURL string    `gorm:"type:text"`
	UserAgent  string    `gorm:"type:text"`
	Services   uint64    
	ReceivedAt time.Time `gorm:"index"`
}