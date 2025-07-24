package model

import (
	"time"
)

// Block represents a block announcement message
type Block struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	Hash       string    `gorm:"index;not null"`
	Height     uint32    `gorm:"index;not null"`
	DataHubURL string    `gorm:"type:text"`
	PeerID     string    `gorm:"index;not null"`
	ReceivedAt time.Time
}