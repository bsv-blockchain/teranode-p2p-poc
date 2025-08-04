package model

import "gorm.io/gorm"

// MigrateAll runs auto-migration for all models
func MigrateAll(db *gorm.DB) error {
	return db.AutoMigrate(
		&Message{},      // Keep existing generic message table
		&Block{},
		&BlockHeader{},  // New table for parsed block headers
		&BestBlockRequest{},
		&MiningOn{},
		&Subtree{},
		&Handshake{},
		&RejectedTx{},
		&StatsCache{},   // Pre-calculated statistics cache
	)
}