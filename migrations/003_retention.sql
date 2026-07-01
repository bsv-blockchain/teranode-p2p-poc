-- 003_retention.sql
-- Reference copy of the retention objects. The application installs these at startup via
-- pkg/model/retention.go (EnsureRetentionObjects); this file exists for manual parity only.

-- Remove the dead rejected_txes table (feature removed in commit a31e3e0).
DROP TABLE IF EXISTS rejected_txes;

-- Ensure current + next month partitions for every partitioned table (relkind='p').
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
            IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = pname AND relnamespace = 'public'::regnamespace) THEN
                EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                    pname, parent.name, start_date, end_date);
                RAISE NOTICE 'Created partition %', pname;
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop month-partitions older than the retention window across all partitioned tables.
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
              AND c.relname ~ ('^' || parent.name || '_[0-9]{4}_(0[1-9]|1[0-2])$')
        LOOP
            BEGIN
                part_month := to_date(right(child.name, 7), 'YYYY_MM');
                IF part_month < cutoff THEN
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
$$ LANGUAGE plpgsql;

-- Indexes referenced by the Go model tags (models_postgres.go) for tables whose shape varies
-- by deployment (plain via AutoMigrate in PROD, partitioned via 001 locally). IF NOT EXISTS is
-- safe to run against either shape.
CREATE INDEX IF NOT EXISTS idx_blockheaders_received_at ON block_headers (received_at);
CREATE INDEX IF NOT EXISTS idx_handshakes_received_at ON handshakes (received_at);
CREATE INDEX IF NOT EXISTS idx_miningons_received_at ON mining_ons (received_at);
CREATE INDEX IF NOT EXISTS idx_subtrees_received_at ON subtrees (received_at);
CREATE INDEX IF NOT EXISTS idx_bestblock_received_at ON best_block_requests (received_at);

-- Row shape (plain vs partitioned) for blocks, block_headers, handshakes, mining_ons, subtrees,
-- and best_block_requests is detected at RUNTIME via pg_class.relkind (see
-- pkg/model/retention.go, deleteOldRows / tableRelkind). Partitioned tables are pruned by
-- dropping old partitions (drop_old_partitions); plain tables are pruned by batched row DELETE.
-- Do not assume either shape here — PROD has these plain, migrations/001 and local docker have
-- them partitioned.
