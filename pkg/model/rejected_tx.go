package model

import (
	"time"
)

// RejectedTx represents a rejected transaction notification
type RejectedTx struct {
	ID         uint      `gorm:"primaryKey"`
	Network    string    `gorm:"index;not null"`
	TxID       string    `gorm:"index;not null"`
	Reason     string    `gorm:"type:text"`
	PeerID     string    `gorm:"index;not null"`
	ReceivedAt time.Time `gorm:"autoCreateTime"`
}