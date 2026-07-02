package model

import (
	"fmt"
	"regexp"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// rowPruneCandidates are the message tables (excluding node_statuses) that MAY be pruned by
// row DELETE. Whether a given table actually is plain (relkind='r') vs partitioned
// (relkind='p') varies by deployment: PROD has these built PLAIN by GORM AutoMigrate, while
// migrations/001 (and the local docker DB) provision them PARTITIONED. deleteOldRows decides
// per-table, at runtime, via pg_class.relkind — never assume the shape here.
var rowPruneCandidates = []string{
	"blocks", "block_headers", "handshakes", "mining_ons", "subtrees", "best_block_requests",
}

// createMonthlyPartitionsSQL (re)defines a function that ensures the current and next
// month partitions exist for every partitioned table (relkind='p') in the public schema that
// is also in this app's table allowlist.
const createMonthlyPartitionsSQL = `
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    parent record;
    m int;
    start_date date;
    end_date date;
    pname text;
BEGIN
    SET LOCAL lock_timeout = '5s';
    FOR parent IN
        SELECT c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'p' AND n.nspname = 'public'
          AND c.relname = ANY(ARRAY['blocks','block_headers','handshakes','mining_ons','subtrees','node_statuses'])
    LOOP
        FOR m IN 0..1 LOOP
            start_date := date_trunc('month', CURRENT_DATE) + make_interval(months => m);
            end_date := start_date + interval '1 month';
            pname := parent.name || '_' || to_char(start_date, 'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = pname AND relnamespace = 'public'::regnamespace) THEN
                EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    pname, parent.name, start_date, end_date);
                RAISE NOTICE 'Created partition %', pname;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;`

// dropOldPartitionsSQL (re)defines a function that drops month-partitions older than the
// retention window across every partitioned table (relkind='p') in the public schema that is
// also in this app's table allowlist. Before dropping, it double-checks the partition holds no
// in-window rows — protects against a partition whose actual bound is wider than its name
// suggests (dropping by name alone could otherwise destroy in-window rows).
const dropOldPartitionsSQL = `
CREATE OR REPLACE FUNCTION drop_old_partitions(keep_months int)
RETURNS void AS $$
DECLARE
    parent record;
    child record;
    cutoff date;
    part_month date;
    has_inwindow boolean;
BEGIN
    SET LOCAL lock_timeout = '5s';
    IF keep_months < 1 THEN
        keep_months := 1;
    END IF;
    cutoff := date_trunc('month', CURRENT_DATE) - make_interval(months => keep_months - 1);

    FOR parent IN
        SELECT c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'p' AND n.nspname = 'public'
          AND c.relname = ANY(ARRAY['blocks','block_headers','handshakes','mining_ons','subtrees','node_statuses'])
    LOOP
        FOR child IN
            SELECT c.relname AS name
            FROM pg_inherits i
            JOIN pg_class c ON c.oid = i.inhrelid
            JOIN pg_class p ON p.oid = i.inhparent
            WHERE p.relname = parent.name
              AND c.relname ~ ('^' || parent.name || '_[0-9]{4}_(0[1-9]|1[0-2])$')
        LOOP
            BEGIN
                part_month := to_date(right(child.name, 7), 'YYYY_MM');
                IF part_month < cutoff THEN
                    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I WHERE received_at >= %L)', child.name, cutoff) INTO has_inwindow;
                    IF has_inwindow THEN
                        RAISE WARNING 'drop_old_partitions: skipping % — holds in-window rows (received_at >= %)', child.name, cutoff;
                        CONTINUE;
                    END IF;
                    EXECUTE format('DROP TABLE IF EXISTS %I', child.name);
                    RAISE NOTICE 'Dropped old partition %', child.name;
                END IF;
            EXCEPTION WHEN others THEN
                RAISE WARNING 'drop_old_partitions: skipped %: %', child.name, SQLERRM;
                CONTINUE;
            END;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;`

// retentionReceivedAtIndexes creates the received_at index needed by deleteOldRows' DELETE
// subquery on each row-prune candidate table that doesn't already get one from AutoMigrate
// (models_postgres.go gorm tags cover the plain-shape deployments; deployments provisioned via
// migrations/001 as partitioned tables never run AutoMigrate for these indexes). blocks and
// node_statuses already have theirs created elsewhere and are intentionally excluded here.
// Index names match the gorm tags in models_postgres.go exactly, so this is a no-op once
// AutoMigrate (or a prior boot of this function) has created them.
var retentionReceivedAtIndexes = []string{
	"CREATE INDEX IF NOT EXISTS idx_blockheaders_received_at ON block_headers (received_at)",
	"CREATE INDEX IF NOT EXISTS idx_handshakes_received_at ON handshakes (received_at)",
	"CREATE INDEX IF NOT EXISTS idx_miningons_received_at ON mining_ons (received_at)",
	"CREATE INDEX IF NOT EXISTS idx_subtrees_received_at ON subtrees (received_at)",
	"CREATE INDEX IF NOT EXISTS idx_bestblock_received_at ON best_block_requests (received_at)",
}

// EnsureRetentionObjects installs the retention plpgsql functions, the received_at indexes the
// row-prune DELETE subquery depends on, and removes the dead rejected_txes table (removed from
// the app in commit a31e3e0). Idempotent; safe every boot. Runs synchronously at startup
// pre-subscribe, so these are plain CREATE INDEX (not CONCURRENTLY) — blocking briefly is
// acceptable here, and IF NOT EXISTS makes every statement a no-op once the index exists.
func EnsureRetentionObjects(db *gorm.DB, log *logrus.Logger) error {
	if err := db.Exec(createMonthlyPartitionsSQL).Error; err != nil {
		return fmt.Errorf("create create_monthly_partitions: %w", err)
	}
	if err := db.Exec(dropOldPartitionsSQL).Error; err != nil {
		return fmt.Errorf("create drop_old_partitions: %w", err)
	}
	for _, stmt := range retentionReceivedAtIndexes {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("create received_at index (%s): %w", stmt, err)
		}
	}
	if err := db.Exec("DROP TABLE IF EXISTS public.rejected_txes").Error; err != nil {
		return fmt.Errorf("drop rejected_txes: %w", err)
	}
	log.Info("retention: SQL objects ensured, received_at indexes ensured, rejected_txes dropped if present")
	return nil
}

// EnsureAutovacuumSettings makes autovacuum more aggressive on the row-DELETE-pruned tables,
// which accumulate dead tuples from retention. Idempotent; safe every boot. node_statuses is
// excluded (pruned by dropping partitions, not row deletes; parent params don't cascade in PG15).
func EnsureAutovacuumSettings(db *gorm.DB, log *logrus.Logger) error {
	for _, t := range rowPruneCandidates {
		sql := fmt.Sprintf(
			"ALTER TABLE IF EXISTS %s SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.02)", t)
		if err := db.Exec(sql).Error; err != nil {
			log.Warnf("retention: autovacuum settings on %s failed: %v", t, err)
		}
	}
	return nil
}

// retentionCutoff returns the start of the month (current − (keepMonths−1)) in UTC.
// Rows/partitions strictly older than this are pruned. keepMonths is floored at 1.
//
// Correctness depends on the DB session timezone matching this function's UTC basis:
// the Go side uses time.Now().UTC(), the SQL side (create_monthly_partitions /
// drop_old_partitions) uses CURRENT_DATE — they must agree. The DSN pins TimeZone=UTC
// (cmd/main.go, and TERANODE_P2P_TEST_DSN for tests) to keep the two sides in sync.
func retentionCutoff(keepMonths int) time.Time {
	if keepMonths < 1 {
		keepMonths = 1
	}
	now := time.Now().UTC()
	firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	return firstOfMonth.AddDate(0, -(keepMonths - 1), 0)
}

// deleteOldRowsMaxBatches is a defensive hard cap on the number of DELETE batches per table.
// At 20000 rows/batch this bounds a single table to 2 billion rows before we bail out; it
// should never be hit in practice and guards only against a pathological infinite loop.
const deleteOldRowsMaxBatches = 100000

// deleteOldRowsProgressLogEvery throttles the per-batch progress log in deleteOldRows to avoid
// flooding logs on a large first run (e.g. ~406 batches pruning subtrees). The final per-table
// total is always logged regardless of this throttle.
const deleteOldRowsProgressLogEvery = 20

// validTableName matches the safe subset of identifiers deleteOldRows will interpolate into
// SQL. Table names come from the hardcoded rowPruneCandidates list, never user input, but this
// is a defense-in-depth guard against a future caller passing something unexpected.
var validTableName = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// tableRelkind looks up the pg_class.relkind of a public-schema table/relation by name.
// Returns ("", nil) if no such relation exists (never treat that as an error — a candidate
// table absent in this deployment's schema is simply skipped).
func tableRelkind(db *gorm.DB, table string) (string, error) {
	var relkind string
	err := db.Raw(
		`SELECT c.relkind FROM pg_class c
		 JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE n.nspname = 'public' AND c.relname = ?`, table).Scan(&relkind).Error
	if err != nil {
		return "", err
	}
	return relkind, nil
}

// deleteOldRows removes rows older than the retention cutoff, in batches of 20000 to bound
// lock duration, WAL, and dead-tuple buildup. Table names must come from a trusted allowlist
// (they are interpolated into SQL).
//
// Each candidate table's actual shape is checked at runtime via pg_class.relkind before any
// DELETE is issued:
//   - Table doesn't exist (no pg_class row) -> skipped silently, no error. Deployments vary
//     in which message tables they even have.
//   - relkind != 'r' (e.g. 'p' partitioned parent) -> skipped; partitioned tables are already
//     pruned by drop_old_partitions (whole-partition DROP), and a row-DELETE there would be
//     both redundant and, historically, unsafe (see below). Logged at Info, not Error.
//   - relkind == 'r' (plain table) -> batched id-based DELETE proceeds as before.
//
// The DELETE predicate uses the id (BIGSERIAL PK) rather than ctid: ctid is only unique
// within a single heap file, so on a PARTITIONED table the same ctid can identify unrelated
// rows in other partitions, making a ctid-based batched delete unsafe for partitioned tables.
// Since this function now only ever DELETEs from plain (relkind='r') tables, id is the sole
// PK there and is genuinely globally unique for that table — the id-based batched delete is
// correct. (On a partitioned table the PK is (id, received_at), and id alone is only unique
// by shared-BIGSERIAL-sequence convention across partitions — but that path is skipped here.)
//
// A failure on one table is logged and does not abort the remaining tables; the function
// returns a wrapped error listing which tables failed (nil if all succeeded).
func deleteOldRows(db *gorm.DB, log *logrus.Logger, keepMonths int, tables []string) error {
	cutoff := retentionCutoff(keepMonths)
	var failed []string
	for _, t := range tables {
		if !validTableName.MatchString(t) {
			log.Errorf("retention: table name %q does not match %s, skipping", t, validTableName.String())
			failed = append(failed, t)
			continue
		}

		relkind, err := tableRelkind(db, t)
		if err != nil {
			log.Errorf("retention: checking relkind for %s failed: %v", t, err)
			failed = append(failed, t)
			continue
		}
		if relkind == "" {
			log.Debugf("retention: %s does not exist, skipping", t)
			continue
		}
		if relkind != "r" {
			log.Infof("retention: skipping non-plain relation %s (relkind=%s)", t, relkind)
			continue
		}

		var total int64
		batches := 0
		for {
			batches++
			if batches > deleteOldRowsMaxBatches {
				log.Warnf("retention: %s exceeded %d batches, aborting this table's prune pass (deleted %d rows so far)", t, deleteOldRowsMaxBatches, total)
				break
			}
			sql := fmt.Sprintf(
				"DELETE FROM %s WHERE id IN (SELECT id FROM %s WHERE received_at < ? LIMIT 20000)",
				t, t)
			res := db.Exec(sql, cutoff)
			if res.Error != nil {
				log.Errorf("retention: delete old rows from %s failed: %v", t, res.Error)
				failed = append(failed, t)
				break
			}
			total += res.RowsAffected
			if res.RowsAffected > 0 && batches%deleteOldRowsProgressLogEvery == 0 {
				log.Infof("retention: %s pruning, %d rows so far", t, total)
			}
			if res.RowsAffected == 0 {
				break
			}
		}
		log.Infof("retention: deleted %d rows older than %s from %s", total, cutoff.Format("2006-01-02"), t)
	}
	if len(failed) > 0 {
		return fmt.Errorf("delete old rows failed for tables: %v", failed)
	}
	return nil
}

// RunRetention runs one full prune pass: ensure partitions, drop old partitions, delete old
// rows from whichever candidate tables turn out to be plain (see deleteOldRows). Errors are
// logged, not returned — retention must never crash the app. Regardless of per-step outcome, it
// always emits one distinct high-signal line at the end so a failed pass is greppable even if
// the per-step error logs above scroll out of view (disk can otherwise grow unbounded silently).
func RunRetention(db *gorm.DB, log *logrus.Logger, keepMonths int) {
	ok := true
	if err := db.Exec("SELECT create_monthly_partitions()").Error; err != nil {
		log.Errorf("retention: create_monthly_partitions failed: %v", err)
		ok = false
	}
	if err := db.Exec("SELECT drop_old_partitions(?)", keepMonths).Error; err != nil {
		log.Errorf("retention: drop_old_partitions failed: %v", err)
		ok = false
	}
	if err := deleteOldRows(db, log, keepMonths, rowPruneCandidates); err != nil {
		log.Errorf("retention: deleteOldRows failed: %v", err)
		ok = false
	}
	for _, t := range rowPruneCandidates {
		if err := db.Exec("ANALYZE " + t).Error; err != nil { // t from fixed allowlist
			log.Warnf("retention: ANALYZE %s failed: %v", t, err)
		}
	}
	if ok {
		log.Infof("retention: pass completed OK")
	} else {
		log.Errorf("retention: pass completed WITH FAILURES — disk may grow unbounded, investigate")
	}
}
