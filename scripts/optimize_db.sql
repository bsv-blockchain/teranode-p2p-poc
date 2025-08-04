-- SQLite Database Optimization Script for Teranode P2P
-- This script optimizes the database for high-volume production use
-- Backup your database before running this script!

-- Enable Write-Ahead Logging (WAL) mode
-- This allows multiple readers concurrent with a single writer
PRAGMA journal_mode=WAL;

-- Set synchronous mode to NORMAL (good balance of safety and performance)
PRAGMA synchronous=NORMAL;

-- Increase cache size (negative value means KB, -20000 = 20MB)
PRAGMA cache_size=-20000;

-- Enable memory-mapped I/O (helps with read performance)
PRAGMA mmap_size=268435456; -- 256MB

-- Optimize database
VACUUM;
ANALYZE;

-- Create indexes if they don't exist
-- Note: GORM auto-migration should have created most of these,
-- but this ensures they exist for production optimization

-- Stats cache table indexes
CREATE INDEX IF NOT EXISTS idx_stats_caches_calculated_at ON stats_caches(calculated_at);

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic);
CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at);

-- Blocks table indexes
CREATE INDEX IF NOT EXISTS idx_blocks_network ON blocks(network);
CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
CREATE INDEX IF NOT EXISTS idx_blocks_peer_id ON blocks(peer_id);
CREATE INDEX IF NOT EXISTS idx_blocks_received_at ON blocks(received_at);

-- Block headers table indexes
CREATE INDEX IF NOT EXISTS idx_block_headers_network ON block_headers(network);
CREATE INDEX IF NOT EXISTS idx_block_headers_hash ON block_headers(hash);
CREATE INDEX IF NOT EXISTS idx_block_headers_height ON block_headers(height);
CREATE INDEX IF NOT EXISTS idx_block_headers_timestamp ON block_headers(timestamp);
CREATE INDEX IF NOT EXISTS idx_block_headers_previous_hash ON block_headers(previous_hash);
CREATE INDEX IF NOT EXISTS idx_block_headers_received_at ON block_headers(received_at);
CREATE INDEX IF NOT EXISTS idx_block_headers_miner_address ON block_headers(miner_address);
CREATE INDEX IF NOT EXISTS idx_block_headers_coinbase_tx_id ON block_headers(coinbase_tx_id);

-- Best block requests table indexes
CREATE INDEX IF NOT EXISTS idx_best_block_requests_network ON best_block_requests(network);
CREATE INDEX IF NOT EXISTS idx_best_block_requests_peer_id ON best_block_requests(peer_id);
CREATE INDEX IF NOT EXISTS idx_best_block_requests_received_at ON best_block_requests(received_at);

-- Mining on table indexes
CREATE INDEX IF NOT EXISTS idx_mining_ons_network ON mining_ons(network);
CREATE INDEX IF NOT EXISTS idx_mining_ons_hash ON mining_ons(hash);
CREATE INDEX IF NOT EXISTS idx_mining_ons_previous_hash ON mining_ons(previous_hash);
CREATE INDEX IF NOT EXISTS idx_mining_ons_peer_id ON mining_ons(peer_id);
CREATE INDEX IF NOT EXISTS idx_mining_ons_height ON mining_ons(height);
CREATE INDEX IF NOT EXISTS idx_mining_ons_miner ON mining_ons(miner);
CREATE INDEX IF NOT EXISTS idx_mining_ons_received_at ON mining_ons(received_at);

-- Subtrees table indexes
CREATE INDEX IF NOT EXISTS idx_subtrees_network ON subtrees(network);
CREATE INDEX IF NOT EXISTS idx_subtrees_hash ON subtrees(hash);
CREATE INDEX IF NOT EXISTS idx_subtrees_peer_id ON subtrees(peer_id);
CREATE INDEX IF NOT EXISTS idx_subtrees_received_at ON subtrees(received_at);

-- Handshakes table indexes
CREATE INDEX IF NOT EXISTS idx_handshakes_network ON handshakes(network);
CREATE INDEX IF NOT EXISTS idx_handshakes_type ON handshakes(type);
CREATE INDEX IF NOT EXISTS idx_handshakes_peer_id ON handshakes(peer_id);
CREATE INDEX IF NOT EXISTS idx_handshakes_best_height ON handshakes(best_height);
CREATE INDEX IF NOT EXISTS idx_handshakes_best_hash ON handshakes(best_hash);
CREATE INDEX IF NOT EXISTS idx_handshakes_received_at ON handshakes(received_at);

-- Rejected transactions table indexes
CREATE INDEX IF NOT EXISTS idx_rejected_txes_network ON rejected_txes(network);
CREATE INDEX IF NOT EXISTS idx_rejected_txes_tx_id ON rejected_txes(tx_id);
CREATE INDEX IF NOT EXISTS idx_rejected_txes_peer_id ON rejected_txes(peer_id);
CREATE INDEX IF NOT EXISTS idx_rejected_txes_received_at ON rejected_txes(received_at);

-- Compound indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_messages_topic_received_at ON messages(topic, received_at);
CREATE INDEX IF NOT EXISTS idx_blocks_network_height ON blocks(network, height);
CREATE INDEX IF NOT EXISTS idx_block_headers_network_height ON block_headers(network, height);
CREATE INDEX IF NOT EXISTS idx_block_headers_network_timestamp ON block_headers(network, timestamp);

-- Indexes for stats calculation performance
CREATE INDEX IF NOT EXISTS idx_messages_peer_received_at ON messages(peer, received_at);
CREATE INDEX IF NOT EXISTS idx_blocks_peer_id_received_at ON blocks(peer_id, received_at);
CREATE INDEX IF NOT EXISTS idx_mining_ons_peer_id_received_at ON mining_ons(peer_id, received_at);
CREATE INDEX IF NOT EXISTS idx_subtrees_peer_id_received_at ON subtrees(peer_id, received_at);
CREATE INDEX IF NOT EXISTS idx_handshakes_peer_id_received_at ON handshakes(peer_id, received_at);
CREATE INDEX IF NOT EXISTS idx_rejected_txes_peer_id_received_at ON rejected_txes(peer_id, received_at);
CREATE INDEX IF NOT EXISTS idx_best_block_requests_peer_id_received_at ON best_block_requests(peer_id, received_at);

-- Update statistics
ANALYZE;

-- Check integrity
PRAGMA integrity_check;

-- Display current settings
SELECT 'Journal Mode: ' || journal_mode FROM pragma_journal_mode();
SELECT 'Synchronous: ' || synchronous FROM pragma_synchronous();
SELECT 'Cache Size: ' || cache_size FROM pragma_cache_size();
SELECT 'Page Count: ' || page_count FROM pragma_page_count();
SELECT 'Page Size: ' || page_size FROM pragma_page_size();