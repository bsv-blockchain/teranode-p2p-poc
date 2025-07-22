package model

import (
	"time"
)

// Subtree represents a subtree (transaction batch) announcement message
type Subtree struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	Hash       string    `gorm:"index;not null"`
	DataHubURL string    `gorm:"type:text"`
	PeerID     string    `gorm:"index;not null"`
	ReceivedAt time.Time `gorm:"autoCreateTime"`
}