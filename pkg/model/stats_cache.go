package model

import (
	"time"
)

// StatsCache stores pre-calculated statistics for fast retrieval
type StatsCache struct {
	ID                uint      `gorm:"primaryKey"`
	TotalMessages     int64     `gorm:"not null"`
	UniqueTopics      int       `gorm:"not null"`
	UniquePeers       int       `gorm:"not null"`
	MessagesToday     int64     `gorm:"not null"`
	
	// Network-specific stats stored as JSON
	LatestBlockHeights string    `gorm:"type:text"` // JSON map[string]uint32
	TopicStats         string    `gorm:"type:text"` // JSON array of topic stats
	TopPeers           string    `gorm:"type:text"` // JSON array of peer summaries
	
	// Metadata
	CalculatedAt      time.Time `gorm:"not null;index"`
	CalculationTimeMs int64     `gorm:"not null"` // Time taken to calculate stats in milliseconds
	
	// Additional pre-calculated values
	MessageCountByTable string   `gorm:"type:text"` // JSON map[string]int64
	NetworkActivity     string   `gorm:"type:text"` // JSON map[string]int64
	LastMessageTime     *time.Time
}