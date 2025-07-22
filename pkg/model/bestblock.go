package model

import (
	"time"
)

// BestBlockRequest represents a request for the best block information from a peer
type BestBlockRequest struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	PeerID     string    `gorm:"index;not null"`
	ReceivedAt time.Time `gorm:"autoCreateTime"`
}