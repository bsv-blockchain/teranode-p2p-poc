package service

import (
	"os"
	"testing"

	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func statsTestDB(t *testing.T) *gorm.DB {
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

func TestCountUniquePeersWindowed(t *testing.T) {
	db := statsTestDB(t)
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)
	s := NewStatsService(db, log)

	// best_block_requests is PLAIN in every deployment (safe to INSERT arbitrary received_at,
	// no partition needed). Seed a recent + an out-of-window peer with sentinel ids.
	db.Exec("CREATE TABLE IF NOT EXISTS best_block_requests (id bigserial primary key, network varchar(20), peer_id varchar(100), received_at timestamptz)")
	db.Exec("DELETE FROM best_block_requests WHERE peer_id IN ('peer_recent_x','peer_old_y')")
	t.Cleanup(func() { db.Exec("DELETE FROM best_block_requests WHERE peer_id IN ('peer_recent_x','peer_old_y')") })
	db.Exec("INSERT INTO best_block_requests (network, peer_id, received_at) VALUES ('mainnet','peer_recent_x', now() - interval '1 day')")
	db.Exec("INSERT INTO best_block_requests (network, peer_id, received_at) VALUES ('mainnet','peer_old_y', now() - interval '30 days')")

	// Assert the 7-day predicate (the same one countUniquePeers uses) includes the recent peer
	// and excludes the 30-day-old one — membership, not a global total.
	var recentSeen, oldSeen []string
	db.Table("best_block_requests").Distinct("peer_id").
		Where("received_at > now() - interval '7 days' AND peer_id = 'peer_recent_x'").Pluck("peer_id", &recentSeen)
	db.Table("best_block_requests").Distinct("peer_id").
		Where("received_at > now() - interval '7 days' AND peer_id = 'peer_old_y'").Pluck("peer_id", &oldSeen)
	if len(recentSeen) != 1 {
		t.Fatalf("recent peer should be within 7d window, got %v", recentSeen)
	}
	if len(oldSeen) != 0 {
		t.Fatalf("30-day-old peer must be excluded by 7d window, got %v", oldSeen)
	}

	// And countUniquePeers must run cleanly (no phantom `messages` table error) and count the recent peer.
	if n := s.countUniquePeers(); n < 1 {
		t.Fatalf("countUniquePeers returned %d, expected >=1", n)
	}
}
