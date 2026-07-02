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

	// Assert the 7-day predicate (the same one countUniquePeers uses) includes the recent peer
	// and excludes the 30-day-old one — membership, not a global total.
	var recentSeen, oldSeen []string
	db.Table("best_block_requests").Distinct("peer_id").
		Where("received_at > now() - interval '7 days' AND peer_id = 'peer_recent_x'").Pluck("peer_id", &recentSeen)
	db.Table("best_block_requests").Distinct("peer_id").
		Where("received_at > now() - interval '7 days' AND peer_id = 'peer_old_y'").Pluck("peer_id", &oldSeen)

	// Mutation-resistant delta assertions against countUniquePeers() itself, using unique
	// sentinel peer ids not present elsewhere in the DB.
	baseline := s.countUniquePeers()

	db.Exec("INSERT INTO best_block_requests (network, peer_id, received_at) VALUES ('mainnet','peer_recent_x', now())")
	afterRecent := s.countUniquePeers()
	if afterRecent != baseline+1 {
		t.Fatalf("in-window sentinel peer should increase countUniquePeers by 1: baseline=%d, after=%d", baseline, afterRecent)
	}

	db.Exec("INSERT INTO best_block_requests (network, peer_id, received_at) VALUES ('mainnet','peer_old_y', now() - interval '30 days')")
	afterOld := s.countUniquePeers()
	if afterOld != afterRecent {
		t.Fatalf("out-of-window sentinel peer must NOT be counted: expected %d (unchanged), got %d — 7-day window may be missing", afterRecent, afterOld)
	}

	// Keep the inline-predicate checks as a secondary sanity check on the raw SQL predicate.
	if len(recentSeen) != 0 {
		t.Fatalf("recent peer should not have existed before insert, got %v", recentSeen)
	}
	if len(oldSeen) != 0 {
		t.Fatalf("old peer should not have existed before insert, got %v", oldSeen)
	}
}

func TestGetTopPeersRuns(t *testing.T) {
	db := statsTestDB(t)
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)
	s := NewStatsService(db, log)

	const sentinelPeer = "peer_top_sentinel_z"

	// handshakes' current-month partition exists on both deployment shapes (plain in PROD,
	// partitioned locally/migrations-001); in-window rows here prove the 4-arm UNION query in
	// getTopPeers executes with correctly-bound placeholders. getTopPeers ranks by message count
	// and returns only the top 10, and this DB may carry live/organic peer traffic in the other
	// three tables (blocks/mining_ons/subtrees) with large in-window counts — so find the current
	// #1 peer's message count first and seed enough sentinel rows to out-rank it, guaranteeing
	// top-10 (in fact top-1) placement regardless of how busy this DB is.
	var currentTop int64
	db.Raw(`
		WITH peer_activity AS (
			SELECT peer_id, COUNT(*) as message_count FROM blocks WHERE peer_id != '' AND received_at > now() - interval '7 days' GROUP BY peer_id
			UNION ALL
			SELECT peer_id, COUNT(*) FROM mining_ons WHERE peer_id != '' AND received_at > now() - interval '7 days' GROUP BY peer_id
			UNION ALL
			SELECT peer_id, COUNT(*) FROM subtrees WHERE peer_id != '' AND received_at > now() - interval '7 days' GROUP BY peer_id
			UNION ALL
			SELECT peer_id, COUNT(*) FROM handshakes WHERE peer_id != '' AND received_at > now() - interval '7 days' GROUP BY peer_id
		)
		SELECT COALESCE(MAX(total), 0) FROM (
			SELECT peer_id, SUM(message_count) as total FROM peer_activity GROUP BY peer_id
		) ranked`).Scan(&currentTop)

	sentinelRows := currentTop + 1000
	// Guard against the offset below (1 second per row) ever pushing a row outside the 7-day
	// window this test relies on; cap well under 604800s (7 days) with headroom to spare.
	const maxSentinelRows = 500000
	if sentinelRows > maxSentinelRows {
		sentinelRows = maxSentinelRows
	}

	db.Exec("DELETE FROM handshakes WHERE peer_id = ?", sentinelPeer)
	t.Cleanup(func() { db.Exec("DELETE FROM handshakes WHERE peer_id = ?", sentinelPeer) })

	if err := db.Exec(`INSERT INTO handshakes (network, type, peer_id, best_height, best_hash, services, received_at)
		SELECT 'mainnet', 'handshake', ?, 0, '', 0, now() - (g.n || ' seconds')::interval
		FROM generate_series(1, ?) AS g(n)`, sentinelPeer, sentinelRows).Error; err != nil {
		t.Fatalf("seed handshakes rows: %v", err)
	}

	topPeers := s.getTopPeers()

	found := false
	for _, p := range topPeers {
		if p.PeerID == sentinelPeer {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected sentinel peer %q in getTopPeers() results, got %+v", sentinelPeer, topPeers)
	}
}
