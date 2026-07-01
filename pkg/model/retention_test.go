package model

import (
	"os"
	"testing"

	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDB connects to the DSN in TERANODE_P2P_TEST_DSN, or skips the test if unset.
// Start one with: docker-compose -f docker-compose.postgres.yml up -d
// then: TERANODE_P2P_TEST_DSN="host=localhost port=5432 user=teranode password=teranode dbname=teranode_p2p sslmode=disable TimeZone=UTC"
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TERANODE_P2P_TEST_DSN")
	if dsn == "" {
		t.Skip("TERANODE_P2P_TEST_DSN not set; skipping DB integration test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		SkipDefaultTransaction: true,
	})
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	return db
}

func testLog() *logrus.Logger {
	l := logrus.New()
	l.SetLevel(logrus.WarnLevel)
	return l
}

func TestEnsureRetentionObjectsIdempotent(t *testing.T) {
	db := testDB(t)
	log := testLog()

	// A leftover rejected_txes must be removed.
	if err := db.Exec("CREATE TABLE IF NOT EXISTS rejected_txes (id bigserial primary key, received_at timestamptz)").Error; err != nil {
		t.Fatalf("seed rejected_txes: %v", err)
	}

	// Run twice; second run must be a clean no-op.
	for i := 0; i < 2; i++ {
		if err := EnsureRetentionObjects(db, log); err != nil {
			t.Fatalf("EnsureRetentionObjects run %d: %v", i, err)
		}
	}

	var n int64
	if err := db.Raw("SELECT count(*) FROM pg_class WHERE relname = 'rejected_txes'").Scan(&n).Error; err != nil {
		t.Fatalf("check rejected_txes: %v", err)
	}
	if n != 0 {
		t.Fatalf("rejected_txes still present after EnsureRetentionObjects")
	}

	// Both functions must exist and be callable.
	if err := db.Exec("SELECT create_monthly_partitions()").Error; err != nil {
		t.Fatalf("create_monthly_partitions not callable: %v", err)
	}
	if err := db.Exec("SELECT drop_old_partitions(3)").Error; err != nil {
		t.Fatalf("drop_old_partitions not callable: %v", err)
	}
}
