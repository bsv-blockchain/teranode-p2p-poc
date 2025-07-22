package model

import "gorm.io/gorm"

// MigrateAll runs auto-migration for all models
func MigrateAll(db *gorm.DB) error {
	return db.AutoMigrate(
		&Message{},      // Keep existing generic message table
		&Block{},
		&MiningOn{},
		&Subtree{},
		&Handshake{},
		&RejectedTx{},
	)
}