package model

import (
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// plainTables are the non-partitioned message tables pruned by row DELETE.
var plainTables = []string{
	"blocks", "block_headers", "handshakes", "mining_ons", "subtrees", "best_block_requests",
}

// createMonthlyPartitionsSQL (re)defines a function that ensures the current and next
// month partitions exist for every partitioned table (relkind='p') in the public schema.
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
    FOR parent IN
        SELECT c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'p' AND n.nspname = 'public'
    LOOP
        FOR m IN 0..1 LOOP
            start_date := date_trunc('month', CURRENT_DATE) + make_interval(months => m);
            end_date := start_date + interval '1 month';
            pname := parent.name || '_' || to_char(start_date, 'YYYY_MM');
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = pname) THEN
                EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    pname, parent.name, start_date, end_date);
                RAISE NOTICE 'Created partition %', pname;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;`

// dropOldPartitionsSQL (re)defines a function that drops month-partitions older than the
// retention window across every partitioned table (relkind='p') in the public schema.
const dropOldPartitionsSQL = `
CREATE OR REPLACE FUNCTION drop_old_partitions(keep_months int)
RETURNS void AS $$
DECLARE
    parent record;
    child record;
    cutoff date;
    part_month date;
BEGIN
    IF keep_months < 1 THEN
        keep_months := 1;
    END IF;
    cutoff := date_trunc('month', CURRENT_DATE) - make_interval(months => keep_months - 1);

    FOR parent IN
        SELECT c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'p' AND n.nspname = 'public'
    LOOP
        FOR child IN
            SELECT c.relname AS name
            FROM pg_inherits i
            JOIN pg_class c ON c.oid = i.inhrelid
            JOIN pg_class p ON p.oid = i.inhparent
            WHERE p.relname = parent.name
              AND c.relname ~ ('^' || parent.name || '_[0-9]{4}_[0-9]{2}$')
        LOOP
            part_month := to_date(right(child.name, 7), 'YYYY_MM');
            IF part_month < cutoff THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', child.name);
                RAISE NOTICE 'Dropped old partition %', child.name;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;`

// EnsureRetentionObjects installs the retention plpgsql functions and removes the dead
// rejected_txes table (removed from the app in commit a31e3e0). Idempotent; safe every boot.
func EnsureRetentionObjects(db *gorm.DB, log *logrus.Logger) error {
	if err := db.Exec(createMonthlyPartitionsSQL).Error; err != nil {
		return fmt.Errorf("create create_monthly_partitions: %w", err)
	}
	if err := db.Exec(dropOldPartitionsSQL).Error; err != nil {
		return fmt.Errorf("create drop_old_partitions: %w", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS rejected_txes").Error; err != nil {
		return fmt.Errorf("drop rejected_txes: %w", err)
	}
	log.Info("retention: SQL objects ensured, rejected_txes dropped if present")
	return nil
}

// deleteOldRows and RunRetention are added in later tasks.
var _ = plainTables
var _ = time.Now
