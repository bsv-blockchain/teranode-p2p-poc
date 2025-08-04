package model

import (
	"time"
)

type Message struct {
	ID         uint      `gorm:"primaryKey"`
	Topic      string    `gorm:"index;not null"`
	Data       string    `gorm:"type:text;not null"`
	Peer       string    `gorm:"type:text"`
	ReceivedAt time.Time `gorm:"index"`
}
