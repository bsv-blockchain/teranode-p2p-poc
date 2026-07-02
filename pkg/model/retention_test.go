package model

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// testDSNHostRE extracts the `host=...` field from a libpq key=value DSN string (the format
// used throughout this package and by TERANODE_P2P_TEST_DSN). A simple field parse — no new
// deps needed for this guard.
var testDSNHostRE = regexp.MustCompile(`host=(\S+)`)

// testDB connects to the DSN in TERANODE_P2P_TEST_DSN, or skips the test if unset.
// Start one with: docker-compose -f docker-compose.postgres.yml up -d
// then: TERANODE_P2P_TEST_DSN="host=localhost port=5432 user=teranode password=teranode dbname=teranode_p2p sslmode=disable TimeZone=UTC"
//
// WARNING: TERANODE_P2P_TEST_DSN must point ONLY at a throwaway/local test database. These
// tests call drop_old_partitions, which scans and drops old partitions across ALL allowlisted
// partitioned tables in the target DB — pointing this at a real/shared database will drop real
// data. As a guard, testDB refuses to connect to any non-local host unless
// TERANODE_P2P_TEST_ALLOW_REMOTE=1 is explicitly set (see the host check below).
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TERANODE_P2P_TEST_DSN")
	if dsn == "" {
		t.Skip("TERANODE_P2P_TEST_DSN not set; skipping DB integration test")
	}

	host := ""
	if m := testDSNHostRE.FindStringSubmatch(dsn); m != nil {
		host = m[1]
	}
	if host != "localhost" && host != "127.0.0.1" && os.Getenv("TERANODE_P2P_TEST_ALLOW_REMOTE") != "1" {
		t.Fatalf("refusing to run destructive retention tests against non-local host %q; set TERANODE_P2P_TEST_ALLOW_REMOTE=1 to override", host)
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

func TestEnsureAutovacuumSettings(t *testing.T) {
	db := testDB(t)
	log := testLog()
	// best_block_requests is plain in every deployment; use it as the assertion target.
	db.Exec("CREATE TABLE IF NOT EXISTS best_block_requests (id bigserial primary key, network varchar(20), peer_id varchar(100), received_at timestamptz)")

	if err := EnsureAutovacuumSettings(db, log); err != nil {
		t.Fatalf("EnsureAutovacuumSettings: %v", err)
	}
	var reloptions string
	db.Raw(`SELECT array_to_string(reloptions, ',') FROM pg_class WHERE relname='best_block_requests'`).Scan(&reloptions)
	if !strings.Contains(reloptions, "autovacuum_vacuum_scale_factor=0.05") {
		t.Fatalf("expected autovacuum_vacuum_scale_factor=0.05 in reloptions, got %q", reloptions)
	}
	if !strings.Contains(reloptions, "autovacuum_analyze_scale_factor=0.02") {
		t.Fatalf("expected autovacuum_analyze_scale_factor=0.02 in reloptions, got %q", reloptions)
	}
}

// TestEnsureAutovacuumSettingsSkipsPartitioned is the regression test for the relkind gate:
// EnsureAutovacuumSettings must only ALTER a candidate table when it is plain (relkind='r'),
// and must skip (not error/warn-spam) a candidate that is partitioned (relkind='p') on this
// deployment. Candidate table names are fixed (rowPruneCandidates), so we can't substitute a
// throwaway partitioned table under one of those names — instead this asserts both halves of
// the gate directly against the real candidates on the current DB:
//   - best_block_requests (plain on every deployment, including local) gets tuned: its
//     reloptions carry the expected autovacuum_* settings.
//   - whichever candidates are partitioned on THIS DB (subtrees, blocks, block_headers,
//     handshakes, mining_ons — all 'p' on local docker) are confirmed via tableRelkind, and
//     EnsureAutovacuumSettings must still return nil (no error bubbles up) despite those
//     candidates being unalterable via this parameter on PG15. Before the relkind gate existed,
//     the ALTER against a partitioned parent errored ("unrecognized parameter") on every one of
//     these tables on local — this test would have surfaced that as either a returned error (if
//     the code propagated it) or, at minimum, documents the exact skip path so a future
//     regression that removes the gate and starts attempting (and Warnf-spamming on) the ALTER
//     against partitioned candidates is visible in test output.
func TestEnsureAutovacuumSettingsSkipsPartitioned(t *testing.T) {
	db := testDB(t)
	log := testLog()
	db.Exec("CREATE TABLE IF NOT EXISTS best_block_requests (id bigserial primary key, network varchar(20), peer_id varchar(100), received_at timestamptz)")

	// Confirm at least one real candidate is partitioned on this DB — otherwise the gate isn't
	// exercised here and this test would pass vacuously.
	partitionedCandidates := []string{}
	for _, t := range rowPruneCandidates {
		relkind, err := tableRelkind(db, t)
		if err != nil {
			continue
		}
		if relkind == "p" {
			partitionedCandidates = append(partitionedCandidates, t)
		}
	}
	if len(partitionedCandidates) == 0 {
		t.Skip("no partitioned rowPruneCandidates on this DB; relkind gate not exercised here (expected on a plain-shape deployment)")
	}

	if err := EnsureAutovacuumSettings(db, log); err != nil {
		t.Fatalf("EnsureAutovacuumSettings must not error even with partitioned candidates present: %v", err)
	}

	// The plain candidate must still be tuned.
	var reloptions string
	db.Raw(`SELECT array_to_string(reloptions, ',') FROM pg_class WHERE relname='best_block_requests'`).Scan(&reloptions)
	if !strings.Contains(reloptions, "autovacuum_vacuum_scale_factor=0.05") {
		t.Fatalf("expected best_block_requests (plain) to be tuned, reloptions=%q", reloptions)
	}

	// Each partitioned candidate must NOT have gained autovacuum reloptions from this call —
	// PG15 rejects the ALTER on a partitioned parent, so if the gate were removed and the ALTER
	// were attempted, it would error out before setting reloptions; asserting reloptions stay
	// empty here catches any future path that silently makes the ALTER succeed on a partitioned
	// parent without the reader realizing prod-only semantics changed.
	for _, pt := range partitionedCandidates {
		var relkind string
		if k, err := tableRelkind(db, pt); err != nil {
			t.Fatalf("tableRelkind(%s): %v", pt, err)
		} else {
			relkind = k
		}
		if relkind != "p" {
			t.Fatalf("expected %s to still report relkind=p, got %q", pt, relkind)
		}
		var opts string
		db.Raw(`SELECT array_to_string(reloptions, ',') FROM pg_class WHERE relname=?`, pt).Scan(&opts)
		if strings.Contains(opts, "autovacuum_vacuum_scale_factor") {
			t.Fatalf("partitioned candidate %s must be skipped by the relkind gate, but has autovacuum reloptions: %q", pt, opts)
		}
	}
}

func TestRunRetentionAnalyzes(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	db.Exec("CREATE TABLE IF NOT EXISTS best_block_requests (id bigserial primary key, network varchar(20), peer_id varchar(100), received_at timestamptz)")
	db.Exec("INSERT INTO best_block_requests (network, peer_id, received_at) VALUES ('mainnet','p', now())")
	// reset analyze stats baseline
	db.Exec("SELECT pg_stat_reset_single_table_counters('best_block_requests'::regclass)")

	RunRetention(db, log, 3)

	var lastAnalyze *time.Time
	db.Raw(`SELECT last_analyze FROM pg_stat_user_tables WHERE relname='best_block_requests'`).Scan(&lastAnalyze)
	if lastAnalyze == nil {
		t.Fatalf("RunRetention should have ANALYZEd best_block_requests, last_analyze is NULL")
	}
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

// mkAgedPartition creates a range partition of parent named "<parent>_YYYY_MM" for the month
// CURRENT_DATE+offsetMonths, with bounds exactly matching that calendar month (the "well-behaved"
// case: name and bound agree). Returns the partition's relname.
func mkAgedPartition(t *testing.T, db *gorm.DB, parent string, offsetMonths int) string {
	t.Helper()
	var name, start, end string
	db.Raw(`SELECT ? || '_' || to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => ?), 'YYYY_MM')`, parent, offsetMonths).Scan(&name)
	db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths).Scan(&start)
	db.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => ?))::text`, offsetMonths+1).Scan(&end)
	if err := db.Exec(fmt.Sprintf(`CREATE TABLE %s PARTITION OF %s FOR VALUES FROM ('%s') TO ('%s')`, name, parent, start, end)).Error; err != nil {
		t.Fatalf("create partition %s: %v", name, err)
	}
	return name
}

func partitionExists(db *gorm.DB, name string) bool {
	var n int64
	db.Raw("SELECT count(*) FROM pg_class WHERE relname = ?", name).Scan(&n)
	return n > 0
}

// TestDropOldPartitionsSkipsNonAllowlisted is the regression test for B: create_monthly_partitions
// and drop_old_partitions now only ever touch the six hardcoded app table names. A partitioned
// table with a name OUTSIDE that allowlist must be left completely untouched by
// drop_old_partitions, even though it satisfies relkind='p' and has an old-named partition that
// would otherwise be dropped.
func TestDropOldPartitionsSkipsNonAllowlisted(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}

	const parent = "retention_parts_test" // deliberately NOT in the allowlist
	db.Exec("DROP TABLE IF EXISTS " + parent)
	if err := db.Exec(fmt.Sprintf(`CREATE TABLE %s (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`, parent)).Error; err != nil {
		t.Fatalf("create partitioned: %v", err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS " + parent) })

	oldName := mkAgedPartition(t, db, parent, -5)
	curName := mkAgedPartition(t, db, parent, 0)
	nextName := mkAgedPartition(t, db, parent, 1)

	if err := db.Exec("SELECT drop_old_partitions(3)").Error; err != nil {
		t.Fatalf("drop_old_partitions: %v", err)
	}

	// None of the partitions should have moved — the parent name isn't in the allowlist, so
	// drop_old_partitions never even looks at it.
	if !partitionExists(db, oldName) {
		t.Fatalf("old partition %s of a non-allowlisted table must survive (not in allowlist -> untouched)", oldName)
	}
	if !partitionExists(db, curName) {
		t.Fatalf("current partition %s must be kept", curName)
	}
	if !partitionExists(db, nextName) {
		t.Fatalf("next partition %s must be kept", nextName)
	}
}

// withSwappedAllowlistedTable runs fn inside a transaction in which the REAL allowlisted table
// `name` (e.g. "subtrees") — and all of its existing child partitions — have been renamed out of
// the way, so `name` (and the same "_YYYY_MM" partition names the test will create) are free for
// the test to reuse as a throwaway partitioned table. This exercises the actual
// create_monthly_partitions / drop_old_partitions DROP code path — the allowlist matches on
// exact relname, so there is no way to exercise the "this name IS allowlisted, and gets dropped"
// branch other than using one of the six real names. ALTER TABLE ... RENAME only renames the
// named relation, not its children, so existing partitions (e.g. subtrees_2026_07) must be
// renamed individually too or the test's same-named replacement partitions collide with them.
//
// The whole thing runs in one transaction that is ALWAYS rolled back (never committed), so the
// real table, its partitions, and their data are unconditionally restored — including if fn
// calls t.Fatalf, since t.Fatalf only unwinds this goroutine via runtime.Goexit while deferred
// rollback still runs. This is deliberately safer than a rename-then-restore-in-Cleanup approach,
// which would leave a crash-shaped window where the real table is temporarily missing.
func withSwappedAllowlistedTable(t *testing.T, db *gorm.DB, name string, fn func(tx *gorm.DB)) {
	t.Helper()
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatalf("begin tx: %v", tx.Error)
	}
	defer tx.Rollback()

	suffix := "_test_backup_" + fmt.Sprint(os.Getpid())

	var children []string
	if err := tx.Raw(
		`SELECT c.relname FROM pg_inherits i
		 JOIN pg_class c ON c.oid = i.inhrelid
		 JOIN pg_class p ON p.oid = i.inhparent
		 WHERE p.relname = ?`, name).Scan(&children).Error; err != nil {
		t.Fatalf("list existing children of %s: %v", name, err)
	}
	for _, child := range children {
		if err := tx.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", child, child+suffix)).Error; err != nil {
			t.Fatalf("rename real child %s out of the way: %v", child, err)
		}
	}

	if err := tx.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", name, name+suffix)).Error; err != nil {
		t.Fatalf("rename real %s out of the way: %v", name, err)
	}

	fn(tx)
}

// TestDropOldPartitionsDropsAllowlisted proves the actual drop path fires for a table whose name
// IS in the allowlist (B's complement: allowlisted names still work normally). Runs entirely
// inside a rolled-back transaction against the real "subtrees" table name — see
// withSwappedAllowlistedTable for why that's safe.
func TestDropOldPartitionsDropsAllowlisted(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}

	withSwappedAllowlistedTable(t, db, "subtrees", func(tx *gorm.DB) {
		if err := tx.Exec(`CREATE TABLE subtrees (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`).Error; err != nil {
			t.Fatalf("create throwaway subtrees: %v", err)
		}

		oldName := mkAgedPartition(t, tx, "subtrees", -5)
		curName := mkAgedPartition(t, tx, "subtrees", 0)
		nextName := mkAgedPartition(t, tx, "subtrees", 1)

		if err := tx.Exec("SELECT drop_old_partitions(3)").Error; err != nil {
			t.Fatalf("drop_old_partitions: %v", err)
		}

		if partitionExists(tx, oldName) {
			t.Fatalf("old partition %s of allowlisted table subtrees should have been dropped", oldName)
		}
		if !partitionExists(tx, curName) {
			t.Fatalf("current partition %s must be kept", curName)
		}
		if !partitionExists(tx, nextName) {
			t.Fatalf("next partition %s must be kept", nextName)
		}
	})
}

// TestDropOldPartitionsGuardsInWindowBound is the regression test for G: drop_old_partitions
// selects candidates by parsing the "_YYYY_MM" name suffix, but must not trust the name alone —
// it double-checks the partition's actual rows before dropping. This creates a partition NAMED
// as old (5 months back, outside a 3-month window) but whose actual FOR VALUES bound extends
// into the retention window, inserts an in-window row into it, and asserts drop_old_partitions
// leaves it alone (the in-window row survives) despite the misleading name.
func TestDropOldPartitionsGuardsInWindowBound(t *testing.T) {
	db := testDB(t)
	log := testLog()
	if err := EnsureRetentionObjects(db, log); err != nil {
		t.Fatalf("ensure: %v", err)
	}

	withSwappedAllowlistedTable(t, db, "subtrees", func(tx *gorm.DB) {
		if err := tx.Exec(`CREATE TABLE subtrees (id bigserial, received_at timestamptz NOT NULL, PRIMARY KEY (id, received_at)) PARTITION BY RANGE (received_at)`).Error; err != nil {
			t.Fatalf("create throwaway subtrees: %v", err)
		}

		// Partition named "_YYYY_MM" for 5 months ago (outside a 3-month window, so its NAME
		// says "drop me"), but its actual bound runs from 5 months ago all the way to NOW +
		// 1 month — i.e. it also covers the entire in-window period.
		var mispartName, start, end string
		tx.Raw(`SELECT 'subtrees_' || to_char(date_trunc('month', CURRENT_DATE) + make_interval(months => -5), 'YYYY_MM')`).Scan(&mispartName)
		tx.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => -5))::text`).Scan(&start)
		tx.Raw(`SELECT (date_trunc('month', CURRENT_DATE) + make_interval(months => 2))::text`).Scan(&end)
		if err := tx.Exec(fmt.Sprintf(`CREATE TABLE %s PARTITION OF subtrees FOR VALUES FROM ('%s') TO ('%s')`, mispartName, start, end)).Error; err != nil {
			t.Fatalf("create mis-bounded partition: %v", err)
		}

		// Insert an in-window row (today) into the mis-bounded partition via the parent.
		if err := tx.Exec("INSERT INTO subtrees (received_at) VALUES (now())").Error; err != nil {
			t.Fatalf("insert in-window row: %v", err)
		}
		var rowCount int64
		tx.Raw(fmt.Sprintf("SELECT count(*) FROM %s", mispartName)).Scan(&rowCount)
		if rowCount != 1 {
			t.Fatalf("test setup invariant broken: expected the in-window row to land in %s, got %d rows there", mispartName, rowCount)
		}

		if err := tx.Exec("SELECT drop_old_partitions(3)").Error; err != nil {
			t.Fatalf("drop_old_partitions: %v", err)
		}

		if !partitionExists(tx, mispartName) {
			t.Fatalf("partition %s holds an in-window row despite its old-looking name; it must NOT be dropped", mispartName)
		}
		tx.Raw(fmt.Sprintf("SELECT count(*) FROM %s", mispartName)).Scan(&rowCount)
		if rowCount != 1 {
			t.Fatalf("in-window row must survive in %s, got %d rows", mispartName, rowCount)
		}
	})
}

// TestConnectionTimeoutsApplied pins the DSN param names/values Task 5 adds to cmd/main.go's
// connection string: statement_timeout=30000 and lock_timeout=5000 (milliseconds), which pgx
// passes as runtime GUCs. Opens its own tuned connection (independent of main.go) and asserts
// SHOW reports them as 30s/5s.
func TestConnectionTimeoutsApplied(t *testing.T) {
	dsn := os.Getenv("TERANODE_P2P_TEST_DSN")
	if dsn == "" {
		t.Skip("TERANODE_P2P_TEST_DSN not set")
	}
	// Open a connection with the timeout params appended, mirroring main.go's DSN.
	tuned, err := gorm.Open(postgres.Open(dsn+" statement_timeout=30000 lock_timeout=5000"), &gorm.Config{SkipDefaultTransaction: true})
	if err != nil {
		t.Fatalf("open tuned: %v", err)
	}
	var st, lt string
	tuned.Raw("SHOW statement_timeout").Scan(&st)
	tuned.Raw("SHOW lock_timeout").Scan(&lt)
	if st != "30s" {
		t.Fatalf("statement_timeout = %q, want 30s", st)
	}
	if lt != "5s" {
		t.Fatalf("lock_timeout = %q, want 5s", lt)
	}
}
