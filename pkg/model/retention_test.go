package model

import (
	"fmt"
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
//
// WARNING: TERANODE_P2P_TEST_DSN must point ONLY at a throwaway/local test database. These
// tests call drop_old_partitions, which scans and drops old partitions across ALL partitioned
// tables in the target DB — pointing this at a real/shared database will drop real data.
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

func TestDeleteOldRows(t *testing.T) {
	db := testDB(t)
	log := testLog()

	if err := db.Exec("DROP TABLE IF EXISTS retention_prune_test").Error; err != nil {
		t.Fatalf("drop temp: %v", err)
	}
	if err := db.Exec("CREATE TABLE retention_prune_test (id bigserial primary key, received_at timestamptz NOT NULL)").Error; err != nil {
		t.Fatalf("create temp: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS retention_prune_test") })

	// Seed one row per month for the last 6 months plus this month, at day 15.
	if err := db.Exec(`
		INSERT INTO retention_prune_test (received_at)
		SELECT date_trunc('month', now()) - make_interval(months => g) + interval '14 days'
		FROM generate_series(0, 6) g`).Error; err != nil {
		t.Fatalf("seed: %v", err)
	}

	// keepMonths=3 -> cutoff = start of (this month - 2). Keep months offset 0,1,2 -> 3 rows.
	if err := deleteOldRows(db, log, 3, []string{"retention_prune_test"}); err != nil {
		t.Fatalf("deleteOldRows: %v", err)
	}

	var remaining int64
	db.Raw("SELECT count(*) FROM retention_prune_test").Scan(&remaining)
	if remaining != 3 {
		t.Fatalf("expected 3 rows within 3-month window, got %d", remaining)
	}

	// A row exactly at the cutoff month boundary (offset 2, day 1) must be kept.
	db.Exec("DELETE FROM retention_prune_test")
	db.Exec(`INSERT INTO retention_prune_test (received_at)
		VALUES (date_trunc('month', now()) - interval '2 months')`) // exactly at cutoff
	if err := deleteOldRows(db, log, 3, []string{"retention_prune_test"}); err != nil {
		t.Fatalf("deleteOldRows boundary: %v", err)
	}
	db.Raw("SELECT count(*) FROM retention_prune_test").Scan(&remaining)
	if remaining != 1 {
		t.Fatalf("cutoff-boundary row should be kept, got %d rows", remaining)
	}
}

func TestDeleteOldRowsFloorsKeepMonths(t *testing.T) {
	db := testDB(t)
	log := testLog()
	db.Exec("DROP TABLE IF EXISTS retention_floor_test")
	db.Exec("CREATE TABLE retention_floor_test (id bigserial primary key, received_at timestamptz NOT NULL)")
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS retention_floor_test") })
	// One row in the current month must survive keepMonths=0 (floored to 1).
	db.Exec("INSERT INTO retention_floor_test (received_at) VALUES (now())")
	if err := deleteOldRows(db, log, 0, []string{"retention_floor_test"}); err != nil {
		t.Fatalf("deleteOldRows: %v", err)
	}
	var remaining int64
	db.Raw("SELECT count(*) FROM retention_floor_test").Scan(&remaining)
	if remaining != 1 {
		t.Fatalf("keepMonths=0 must be floored to 1 and keep current month; got %d", remaining)
	}
}

// TestRunRetention is a smoke test: RunRetention must not panic or return an error signal
// (it has no return value) regardless of which real message tables exist in the target DB and
// what shape they are in. It deliberately does NOT seed or delete rows in any real message
// table (blocks, block_headers, handshakes, mining_ons, subtrees, best_block_requests,
// node_statuses) — those tables may be shared/real data even in a "throwaway" test DB, and the
// per-table shape routing behavior is covered in isolation by
// TestDeleteOldRowsRoutesByShape using disposable tables.
func TestRunRetention(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	// Must not panic or block, whatever shape/existence the real message tables have.
	RunRetention(db, log, 3)
}

// TestDeleteOldRowsPartitionSafe was originally a regression guard for the ctid-based batched
// delete bug: ctid is only unique within a single heap file, so on a PARTITIONED table a
// ctid-based delete could match and delete rows in the WRONG partition if they happened to
// share the same ctid slot. Since deleteOldRows now routes by runtime relkind (see F1) and
// SKIPS partitioned tables entirely — leaving them to drop_old_partitions — that bug class is
// moot for this function. This test now asserts the (stronger) current invariant: deleteOldRows
// must not touch a partitioned table's rows AT ALL, old or in-window. It still forces the ctid
// collision from the original bug as a belt-and-suspenders check: even if some future change
// re-introduced row-level deletes against partitioned tables, a naive ctid-based delete would
// still be unsafe.
func TestDeleteOldRowsPartitionSafe(t *testing.T) {
	db := testDB(t)
	log := testLog()

	const parent = "retention_delete_parts_test"
	db.Exec("DROP TABLE IF EXISTS " + parent)
	if err := db.Exec(fmt.Sprintf(
		`CREATE TABLE %s (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`,
		parent)).Error; err != nil {
		t.Fatalf("create partitioned parent: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS " + parent) })

	mkPartition := func(offsetMonths int) string {
		var name, start, end string
		db.Raw(`SELECT 'retention_delete_parts_test_' || to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => ?), 'YYYY_MM')`, offsetMonths).Scan(&name)
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths).Scan(&start)
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths+1).Scan(&end)
		if err := db.Exec(fmt.Sprintf(`CREATE TABLE %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')`, name, parent, start, end)).Error; err != nil {
			t.Fatalf("create partition %s: %v", name, err)
		}
		return name
	}

	// OLD partition: well outside a 3-month retention window.
	oldPart := mkPartition(-6)
	// CURRENT partition: inside the 3-month window.
	curPart := mkPartition(0)

	// Insert exactly one row into each partition FIRST, so both land at ctid (0,1) within
	// their respective partition's heap file — the collision the old ctid-based code missed.
	oldTime := ""
	db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => -6) + interval '10 days')::text`).Scan(&oldTime)
	if err := db.Exec(fmt.Sprintf("INSERT INTO %s (received_at) VALUES (?)", parent), oldTime).Error; err != nil {
		t.Fatalf("insert old row: %v", err)
	}
	curTime := ""
	db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + interval '10 days')::text`).Scan(&curTime)
	if err := db.Exec(fmt.Sprintf("INSERT INTO %s (received_at) VALUES (?)", parent), curTime).Error; err != nil {
		t.Fatalf("insert current row: %v", err)
	}

	var oldCtid, curCtid string
	db.Raw(fmt.Sprintf("SELECT ctid::text FROM %s", oldPart)).Scan(&oldCtid)
	db.Raw(fmt.Sprintf("SELECT ctid::text FROM %s", curPart)).Scan(&curCtid)
	if oldCtid != curCtid {
		t.Fatalf("test setup invariant broken: expected both partitions' first row to share ctid, got old=%s cur=%s", oldCtid, curCtid)
	}

	if err := deleteOldRows(db, log, 3, []string{parent}); err != nil {
		t.Fatalf("deleteOldRows: %v", err)
	}

	var oldRemaining, curRemaining int64
	db.Raw(fmt.Sprintf("SELECT count(*) FROM %s", oldPart)).Scan(&oldRemaining)
	db.Raw(fmt.Sprintf("SELECT count(*) FROM %s", curPart)).Scan(&curRemaining)

	// deleteOldRows must SKIP the partitioned parent entirely (relkind='p') and leave both
	// rows untouched — pruning partitioned tables is drop_old_partitions' job.
	if oldRemaining != 1 {
		t.Fatalf("partitioned table must be skipped by deleteOldRows; old-partition row should still be present, got %d remaining", oldRemaining)
	}
	if curRemaining != 1 {
		t.Fatalf("partitioned table must be skipped by deleteOldRows; current-partition row should still be present, got %d remaining", curRemaining)
	}
}

// TestDeleteOldRowsRoutesByShape is the core regression test for F1: deleteOldRows must decide
// per-table, at runtime, whether to DELETE (plain, relkind='r') or skip (partitioned, relkind='p',
// or nonexistent). It creates one throwaway PLAIN table, one throwaway PARTITIONED table (RANGE
// on received_at, mirroring the shape migrations/001 and local docker use for these message
// tables), and references a table name that doesn't exist at all — then asserts:
//   - the plain table's old rows are deleted and in-window rows are kept
//   - the partitioned table is completely untouched (both old and in-window rows survive) —
//     pruning it is drop_old_partitions' job, not deleteOldRows'
//   - the nonexistent table produces no error (silently skipped)
func TestDeleteOldRowsRoutesByShape(t *testing.T) {
	db := testDB(t)
	log := testLog()

	const (
		plainName = "retention_routes_plain_test"
		partName  = "retention_routes_part_test"
		missing   = "retention_nonexistent_xyz"
	)

	db.Exec("DROP TABLE IF EXISTS " + plainName)
	if err := db.Exec(fmt.Sprintf(
		"CREATE TABLE %s (id bigserial primary key, received_at timestamptz NOT NULL)", plainName)).Error; err != nil {
		t.Fatalf("create plain table: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS " + plainName) })

	db.Exec("DROP TABLE IF EXISTS " + partName)
	if err := db.Exec(fmt.Sprintf(
		`CREATE TABLE %s (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`,
		partName)).Error; err != nil {
		t.Fatalf("create partitioned parent: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS " + partName) })

	mkPartition := func(offsetMonths int) string {
		var name, start, end string
		db.Raw(`SELECT ? || '_' || to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => ?), 'YYYY_MM')`, partName, offsetMonths).Scan(&name)
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths).Scan(&start)
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths+1).Scan(&end)
		if err := db.Exec(fmt.Sprintf(`CREATE TABLE %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')`, name, partName, start, end)).Error; err != nil {
			t.Fatalf("create partition %s: %v", name, err)
		}
		return name
	}
	oldPart := mkPartition(-6)
	curPart := mkPartition(0)

	// Seed both tables with one old row (well outside a 3-month window) and one in-window row.
	if err := db.Exec(fmt.Sprintf(
		`INSERT INTO %s (received_at) VALUES (date_trunc('month', now()) - interval '12 months'), (now())`, plainName)).Error; err != nil {
		t.Fatalf("seed plain table: %v", err)
	}
	if err := db.Exec(fmt.Sprintf(
		`INSERT INTO %s (received_at) VALUES ((date_trunc('month', CURRENT_DATE) + make_interval(months => -6) + interval '10 days'))`, partName)).Error; err != nil {
		t.Fatalf("seed partitioned old row: %v", err)
	}
	if err := db.Exec(fmt.Sprintf(
		`INSERT INTO %s (received_at) VALUES (now())`, partName)).Error; err != nil {
		t.Fatalf("seed partitioned current row: %v", err)
	}

	if err := deleteOldRows(db, log, 3, []string{plainName, partName, missing}); err != nil {
		t.Fatalf("deleteOldRows: %v", err)
	}

	var plainRemaining int64
	db.Raw(fmt.Sprintf("SELECT count(*) FROM %s", plainName)).Scan(&plainRemaining)
	if plainRemaining != 1 {
		t.Fatalf("plain table: expected old row deleted and in-window row kept (1 remaining), got %d", plainRemaining)
	}

	var oldPartRemaining, curPartRemaining int64
	db.Raw(fmt.Sprintf("SELECT count(*) FROM %s", oldPart)).Scan(&oldPartRemaining)
	db.Raw(fmt.Sprintf("SELECT count(*) FROM %s", curPart)).Scan(&curPartRemaining)
	if oldPartRemaining != 1 {
		t.Fatalf("partitioned table must be left untouched by deleteOldRows; old partition should still have its row, got %d", oldPartRemaining)
	}
	if curPartRemaining != 1 {
		t.Fatalf("partitioned table must be left untouched by deleteOldRows; current partition should still have its row, got %d", curPartRemaining)
	}

	// The nonexistent table must not produce an error — confirmed by deleteOldRows returning
	// nil above already covering all three tables in one call.
}

func TestDropOldPartitions(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}

	db.Exec("DROP TABLE IF EXISTS retention_parts_test")
	if err := db.Exec(`CREATE TABLE retention_parts_test (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`).Error; err != nil {
		t.Fatalf("create partitioned: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS retention_parts_test") })

	// One old partition (5 months ago), one current, one next — named <parent>_YYYY_MM.
	mk := func(offset int) string {
		var name string
		db.Raw(`SELECT 'retention_parts_test_' || to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => ?), 'YYYY_MM')`, offset).Scan(&name)
		start := ""
		end := ""
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offset).Scan(&start)
		db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offset+1).Scan(&end)
		if err := db.Exec(fmt.Sprintf(`CREATE TABLE %s PARTITION OF retention_parts_test FOR VALUES FROM ('%s') TO ('%s')`, name, start, end)).Error; err != nil {
			t.Fatalf("create partition %s: %v", name, err)
		}
		return name
	}
	oldName := mk(-5)
	curName := mk(0)
	nextName := mk(1)

	if err := db.Exec("SELECT drop_old_partitions(3)").Error; err != nil {
		t.Fatalf("drop_old_partitions: %v", err)
	}

	exists := func(name string) bool {
		var n int64
		db.Raw("SELECT count(*) FROM pg_class WHERE relname = ?", name).Scan(&n)
		return n > 0
	}
	if exists(oldName) {
		t.Fatalf("old partition %s should have been dropped", oldName)
	}
	if !exists(curName) {
		t.Fatalf("current partition %s must be kept", curName)
	}
	if !exists(nextName) {
		t.Fatalf("next partition %s must be kept", nextName)
	}
}
