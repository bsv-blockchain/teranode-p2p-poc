# Teranode P2P POC Refactoring Notes

## Overview
This document describes the refactoring done to support dynamic topic generation and message-specific storage.

## Changes Made

### 1. Configuration Refactoring
- **Old**: Explicit list of all 36 topics in config.yaml
- **New**: List of networks, topics are auto-generated
- **Backwards Compatible**: Falls back to old `topics` config if `networks` not specified

Example new config:
```yaml
networks:
  - "mainnet"
  - "testnet"
  - "regtest"
  - "stn"
  - "teratestnet"
  - "tstn"
```

### 2. Message Type-Specific Storage
Created separate database tables for each message type:
- `best_block_requests` - BestBlock request messages
- `blocks` - Block announcement messages
- `mining_ons` - Mining activity messages
- `subtrees` - Subtree (transaction batch) messages
- `handshakes` - Peer handshake messages
- `rejected_txes` - Rejected transaction notifications

Each table includes:
- Network field for filtering
- Message-specific fields matching the go-p2p types
- ReceivedAt timestamp
- Proper indexes for efficient querying

### 3. Message Parser (`pkg/parser/message_parser.go`)
- Extracts network and message type from topic
- Unmarshals JSON into appropriate go-p2p message structs
- Returns typed messages for proper storage

### 4. New HTTP API Endpoints
Added type-specific endpoints for better querying:
- `/blocks` - Query block announcements
- `/mining` - Query mining activity
- `/subtrees` - Query subtree messages
- `/handshakes` - Query handshake messages
- `/rejected-tx` - Query rejected transactions
- `/networks` - Get available networks
- `/message-types` - Get available message types

All endpoints support:
- Network filtering
- Pagination (limit/offset)
- Type-specific filtering (hash, peer_id, etc.)

### 5. Backwards Compatibility
- Original `/messages` endpoint still works
- Messages are stored in both generic and specific tables
- WebSocket broadcasting unchanged
- Frontend continues to work without modifications

## Benefits
1. **Structured Data**: Each message type has proper schema and indexing
2. **Better Queries**: Can efficiently query by message type and fields
3. **Type Safety**: Messages are validated during parsing
4. **Flexibility**: Easy to add new networks or message types
5. **Analytics Ready**: Structured data enables better analysis

## Migration
When upgrading:
1. Database will auto-migrate new tables on startup
2. Update config.yaml to use `networks` instead of `topics`
3. Existing messages remain in the generic `messages` table
4. New messages will be stored in both generic and specific tables