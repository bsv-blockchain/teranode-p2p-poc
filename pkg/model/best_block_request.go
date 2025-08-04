package model

import (
	"time"
)

// BestBlockRequest represents a best block request message
type BestBlockRequest struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	PeerID     string    `gorm:"index;not null"`
	ReceivedAt time.Time `gorm:"index"`
}