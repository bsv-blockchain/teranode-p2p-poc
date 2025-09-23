-- Create node_statuses table for node status messages
CREATE TABLE IF NOT EXISTS node_statuses (
    id BIGSERIAL,
    network VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    base_url TEXT,
    peer_id VARCHAR(100) NOT NULL,
    version VARCHAR(50),
    commit_hash VARCHAR(64),
    best_block_hash VARCHAR(64) NOT NULL,
    best_height INTEGER NOT NULL,
    block_assembly_details JSONB,
    fsm_state VARCHAR(50),
    start_time BIGINT NOT NULL,
    uptime DOUBLE PRECISION NOT NULL,
    client_name VARCHAR(100),
    miner_name VARCHAR(100),
    listen_mode VARCHAR(50),
    chain_work TEXT,
    sync_peer_id VARCHAR(100),
    sync_peer_height INTEGER DEFAULT 0,
    sync_peer_block_hash VARCHAR(64),
    sync_connected_at BIGINT DEFAULT 0,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Create indexes for node_statuses
CREATE INDEX IF NOT EXISTS idx_nodestatus_network_received ON node_statuses(network, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodestatus_peer_received ON node_statuses(peer_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodestatus_height ON node_statuses(best_height DESC);
CREATE INDEX IF NOT EXISTS idx_nodestatus_miner ON node_statuses(miner_name) WHERE miner_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodestatus_received_at ON node_statuses(received_at DESC);

-- Create initial partitions for node_statuses
CREATE TABLE IF NOT EXISTS node_statuses_2025_09 PARTITION OF node_statuses
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE IF NOT EXISTS node_statuses_2025_10 PARTITION OF node_statuses
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');