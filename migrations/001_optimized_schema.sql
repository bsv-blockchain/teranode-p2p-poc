-- Optimized PostgreSQL schema for handling millions of P2P messages
-- Designed for high-performance queries and efficient storage

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search optimization
CREATE EXTENSION IF NOT EXISTS btree_gin; -- For composite GIN indexes

-- Drop existing tables if migration is run fresh
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS block_headers CASCADE;
DROP TABLE IF EXISTS mining_ons CASCADE;
DROP TABLE IF EXISTS subtrees CASCADE;
DROP TABLE IF EXISTS handshakes CASCADE;
DROP TABLE IF EXISTS rejected_txes CASCADE;
DROP TABLE IF EXISTS best_block_requests CASCADE;
DROP TABLE IF EXISTS stats_caches CASCADE;
DROP TABLE IF EXISTS messages CASCADE;

-- Create blocks table with partitioning by month
CREATE TABLE blocks (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    height INTEGER NOT NULL,
    data_hub_url TEXT,
    peer_id VARCHAR(100) NOT NULL,
    header TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Create indexes for blocks
CREATE INDEX idx_blocks_network_received ON blocks(network, received_at DESC);
CREATE INDEX idx_blocks_peer_received ON blocks(peer_id, received_at DESC);
CREATE INDEX idx_blocks_hash ON blocks USING hash(hash);
CREATE INDEX idx_blocks_height_network ON blocks(height DESC, network);
CREATE INDEX idx_blocks_received_at ON blocks(received_at DESC);

-- Create initial partitions for blocks (last 3 months + next month)
CREATE TABLE blocks_2024_12 PARTITION OF blocks FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE blocks_2025_01 PARTITION OF blocks FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE blocks_2025_02 PARTITION OF blocks FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE blocks_2025_03 PARTITION OF blocks FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create block_headers table with optimized indexes
CREATE TABLE block_headers (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    height INTEGER NOT NULL,
    version INTEGER NOT NULL,
    previous_hash VARCHAR(64),
    merkle_root VARCHAR(64) NOT NULL,
    timestamp INTEGER NOT NULL,
    bits INTEGER NOT NULL,
    nonce BIGINT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    coinbase_value BIGINT DEFAULT 0,
    coinbase_script TEXT,
    miner_address VARCHAR(100),
    coinbase_tx_id VARCHAR(64),
    coinbase_text TEXT,
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Indexes for block_headers
CREATE INDEX idx_blockheaders_network_height ON block_headers(network, height DESC);
CREATE INDEX idx_blockheaders_hash ON block_headers USING hash(hash);
CREATE INDEX idx_blockheaders_timestamp ON block_headers(timestamp DESC);
CREATE INDEX idx_blockheaders_miner ON block_headers(miner_address) WHERE miner_address IS NOT NULL;

-- Create partitions for block_headers
CREATE TABLE block_headers_2024_12 PARTITION OF block_headers FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE block_headers_2025_01 PARTITION OF block_headers FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE block_headers_2025_02 PARTITION OF block_headers FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE block_headers_2025_03 PARTITION OF block_headers FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create handshakes table
CREATE TABLE handshakes (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    peer_id VARCHAR(100) NOT NULL,
    best_height INTEGER NOT NULL,
    best_hash VARCHAR(64) NOT NULL,
    data_hub_url TEXT,
    user_agent TEXT,
    services BIGINT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Indexes for handshakes
CREATE INDEX idx_handshakes_network_received ON handshakes(network, received_at DESC);
CREATE INDEX idx_handshakes_peer_received ON handshakes(peer_id, received_at DESC);
CREATE INDEX idx_handshakes_peer_network ON handshakes(peer_id, network);

-- Create partitions for handshakes
CREATE TABLE handshakes_2024_12 PARTITION OF handshakes FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE handshakes_2025_01 PARTITION OF handshakes FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE handshakes_2025_02 PARTITION OF handshakes FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE handshakes_2025_03 PARTITION OF handshakes FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create mining_ons table
CREATE TABLE mining_ons (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    data_hub_url TEXT,
    peer_id VARCHAR(100) NOT NULL,
    height INTEGER NOT NULL,
    miner VARCHAR(100),
    size_in_bytes INTEGER NOT NULL,
    tx_count INTEGER NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Indexes for mining_ons
CREATE INDEX idx_miningons_network_received ON mining_ons(network, received_at DESC);
CREATE INDEX idx_miningons_peer_received ON mining_ons(peer_id, received_at DESC);
CREATE INDEX idx_miningons_miner ON mining_ons(miner) WHERE miner IS NOT NULL;

-- Create partitions for mining_ons
CREATE TABLE mining_ons_2024_12 PARTITION OF mining_ons FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE mining_ons_2025_01 PARTITION OF mining_ons FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE mining_ons_2025_02 PARTITION OF mining_ons FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE mining_ons_2025_03 PARTITION OF mining_ons FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create subtrees table
CREATE TABLE subtrees (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    hash VARCHAR(64) NOT NULL,
    data_hub_url TEXT,
    peer_id VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Indexes for subtrees
CREATE INDEX idx_subtrees_network_received ON subtrees(network, received_at DESC);
CREATE INDEX idx_subtrees_peer_received ON subtrees(peer_id, received_at DESC);
CREATE INDEX idx_subtrees_hash ON subtrees USING hash(hash);

-- Create partitions for subtrees
CREATE TABLE subtrees_2024_12 PARTITION OF subtrees FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE subtrees_2025_01 PARTITION OF subtrees FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE subtrees_2025_02 PARTITION OF subtrees FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE subtrees_2025_03 PARTITION OF subtrees FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create rejected_txes table
CREATE TABLE rejected_txes (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    tx_id VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    peer_id VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Indexes for rejected_txes
CREATE INDEX idx_rejectedtx_network_received ON rejected_txes(network, received_at DESC);
CREATE INDEX idx_rejectedtx_peer_received ON rejected_txes(peer_id, received_at DESC);
CREATE INDEX idx_rejectedtx_txid ON rejected_txes USING hash(tx_id);

-- Create partitions for rejected_txes
CREATE TABLE rejected_txes_2024_12 PARTITION OF rejected_txes FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');
CREATE TABLE rejected_txes_2025_01 PARTITION OF rejected_txes FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE rejected_txes_2025_02 PARTITION OF rejected_txes FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE rejected_txes_2025_03 PARTITION OF rejected_txes FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

-- Create best_block_requests table
CREATE TABLE best_block_requests (
    id BIGSERIAL PRIMARY KEY,
    network VARCHAR(20) NOT NULL,
    peer_id VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for best_block_requests
CREATE INDEX idx_bestblock_network_received ON best_block_requests(network, received_at DESC);
CREATE INDEX idx_bestblock_peer_received ON best_block_requests(peer_id, received_at DESC);

-- Stats cache table (no partitioning needed)
CREATE TABLE stats_caches (
    id BIGSERIAL PRIMARY KEY,
    calculated_at TIMESTAMPTZ NOT NULL,
    total_messages BIGINT NOT NULL DEFAULT 0,
    messages_today BIGINT NOT NULL DEFAULT 0,
    unique_topics INTEGER NOT NULL DEFAULT 0,
    unique_peers INTEGER NOT NULL DEFAULT 0,
    message_count_by_table JSONB,
    topic_stats JSONB,
    network_activity JSONB,
    latest_block_heights JSONB,
    top_peers JSONB,
    last_message_time TIMESTAMPTZ,
    calculation_time_ms BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_stats_cache_calculated ON stats_caches(calculated_at DESC);

-- Create materialized views for fast statistics

-- Network activity summary
CREATE MATERIALIZED VIEW network_activity_summary AS
SELECT
    network,
    COUNT(*) as total_messages,
    COUNT(DISTINCT peer_id) as unique_peers,
    MAX(received_at) as last_activity,
    'blocks' as source_table
FROM blocks
GROUP BY network
UNION ALL
SELECT
    network,
    COUNT(*) as total_messages,
    COUNT(DISTINCT peer_id) as unique_peers,
    MAX(received_at) as last_activity,
    'handshakes' as source_table
FROM handshakes
GROUP BY network
UNION ALL
SELECT
    network,
    COUNT(*) as total_messages,
    COUNT(DISTINCT peer_id) as unique_peers,
    MAX(received_at) as last_activity,
    'mining_ons' as source_table
FROM mining_ons
GROUP BY network;

CREATE INDEX idx_network_activity_network ON network_activity_summary(network);

-- Peer activity summary
CREATE MATERIALIZED VIEW peer_activity_summary AS
SELECT
    peer_id,
    network,
    COUNT(*) as message_count,
    MIN(received_at) as first_seen,
    MAX(received_at) as last_seen,
    'blocks' as message_type
FROM blocks
GROUP BY peer_id, network
UNION ALL
SELECT
    peer_id,
    network,
    COUNT(*) as message_count,
    MIN(received_at) as first_seen,
    MAX(received_at) as last_seen,
    'handshakes' as message_type
FROM handshakes
GROUP BY peer_id, network;

CREATE INDEX idx_peer_activity_peer ON peer_activity_summary(peer_id);
CREATE INDEX idx_peer_activity_network ON peer_activity_summary(network);

-- Latest block heights view
CREATE MATERIALIZED VIEW latest_block_heights AS
SELECT DISTINCT ON (network)
    network,
    height,
    hash,
    received_at
FROM blocks
ORDER BY network, height DESC, received_at DESC;

CREATE UNIQUE INDEX idx_latest_blocks_network ON latest_block_heights(network);

-- Function to automatically create monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
    table_name text;
    tables text[] := ARRAY['blocks', 'block_headers', 'handshakes', 'mining_ons', 'subtrees', 'rejected_txes'];
BEGIN
    -- Create partition for next month if it doesn't exist
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
    end_date := start_date + interval '1 month';

    FOREACH table_name IN ARRAY tables
    LOOP
        partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');

        -- Check if partition exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_class
            WHERE relname = partition_name
        ) THEN
            EXECUTE format('CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                partition_name, table_name, start_date, end_date);
            RAISE NOTICE 'Created partition % for table %', partition_name, table_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule partition creation (run this monthly via cron or pg_cron)
-- SELECT create_monthly_partitions();

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY network_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY peer_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY latest_block_heights;
END;
$$ LANGUAGE plpgsql;

-- Create indexes on existing partition tables
DO $$
DECLARE
    partition RECORD;
BEGIN
    -- Add BRIN indexes on received_at for all partition tables for efficient time-range queries
    FOR partition IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE '%_2024_%' OR tablename LIKE '%_2025_%'
    LOOP
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_received_at_brin ON %I USING BRIN(received_at)',
                      partition.tablename, partition.tablename);
    END LOOP;
END $$;