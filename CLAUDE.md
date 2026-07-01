# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Quick Start with Makefile
```bash
# Build and run the full application (React + Go server)
make run

# Development mode (starts both React dev server and Go server)
make dev

# Show all available targets
make help
```

### Makefile Targets
```bash
# Build everything (React + Go)
make all

# Build and run production version
make run

# Development mode with hot reload
make dev

# Build React frontend only
make build-frontend

# Build Go binary only
make build-go

# Install React dependencies
make install-frontend

# Run React tests
make test-frontend

# Clean build artifacts
make clean

# Docker operations
make docker-build
make docker-run
```

### Manual Commands

#### Build and Run
```bash
# Build the application
go build -o teranode-p2p-poc cmd/main.go

# Run the application (requires config.yaml)
go run cmd/main.go

# Run with Go modules cleanup
go mod tidy && go run cmd/main.go
```

#### React Frontend Development
```bash
# Install dependencies
cd frontend-react && npm install

# Start development server (runs on port 3000)
cd frontend-react && npm start

# Build React app for production
cd frontend-react && npm run build

# Run tests
cd frontend-react && npm test
```

#### Docker
```bash
# Build Docker image (includes React build)
docker build -t teranode-p2p-poc .

# Run with Docker (requires config.yaml)
docker run -p 8080:8080 -v $(pwd)/config.yaml:/config.yaml teranode-p2p-poc
```

### Testing
```bash
# Run tests
go test ./...

# Run tests with coverage
go test -cover ./...
```

Some tests in `pkg/model` (e.g. `retention_test.go`) are DB integration tests gated on the
`TERANODE_P2P_TEST_DSN` environment variable; they are skipped if it is unset. **`TERANODE_P2P_TEST_DSN`
must point ONLY at a throwaway/local test database** — these tests call `drop_old_partitions`, which
scans and drops old partitions across ALL partitioned tables in the target DB.

## Architecture Overview

This is a BSV Blockchain P2P networking component that provides:

### Core Components
- **P2P Client** (`cmd/main.go`): Uses `github.com/bsv-blockchain/go-p2p-message-bus` (libp2p-based) with `/dnsaddr` bootstrap discovery; runs as a passive listener (`dht_mode: "off"`)
- **Message Storage** (`pkg/model/`): PostgreSQL with GORM. `node_statuses` is always partitioned by month. The other message tables' shape (plain vs partitioned) varies by deployment: PROD has them PLAIN (built by GORM `AutoMigrate`), while `migrations/001` and the local docker DB provision them PARTITIONED. Retention detects each table's actual shape at runtime via `pg_class.relkind` (see below) rather than assuming either — the code handles both.
- **Parser** (`pkg/parser/`): Decodes incoming P2P messages into typed records
- **Batch Insert Service** (`pkg/service/`): Buffers DB writes for throughput; also computes stats
- **HTTP API** (`pkg/http/`): REST API for querying stored messages
- **WebSocket Server** (`pkg/websocket/`): Real-time message broadcasting to connected clients
- **React Frontend** (`frontend-react/`): React/TypeScript application with real-time message viewing

### Key Architecture Patterns
- **Event-Driven**: Messages received via P2P are immediately stored and broadcast via WebSocket
- **Configuration-Driven**: All settings loaded from `config.yaml` with environment variable overrides
- **Modular Design**: Each component (`pkg/`) has clear separation of concerns
- **Concurrent Processing**: HTTP server, WebSocket broadcasting, and P2P networking run in separate goroutines

### Data Flow
1. P2P node subscribes to configured topics from `config.yaml`
2. Incoming messages are buffered by the batch insert service and written to PostgreSQL
3. Messages are simultaneously broadcast to WebSocket clients
4. HTTP API provides historical message querying by topic/peer
5. Frontend provides real-time visualization and search capabilities

## Configuration

The application requires `config.yaml` with these key sections:
- `p2p`: `port`, `bootstrap_peers` (list of `/dnsaddr/` or multiaddr), `dht_mode` (off/client/server), optional `announce_addrs`, `peer_cache_file`, `max_connections`, `min_connections`
- `database`: PostgreSQL `host`, `port`, `user`, `password`, `name`, `sslmode`
- `networks`: List of BSV network names; topics are generated per network
- `redis` (optional): Cache layer
- `performance` (optional): Tuning knobs, including `partition_retention_months` (data retention window; see Runtime Behavior)
- `monitoring` (optional): Tuning knobs

Environment variables can override config values using `TERANODE_P2P_` prefix with underscores replacing dots.

PostgreSQL must be running externally — use `docker-compose -f docker-compose.postgres.yml up -d` to start a local stack alongside `make run`.

## Important Notes

### Dependencies
- Go 1.25.7+ required (see `go.mod`)
- Uses `go-p2p-message-bus` (libp2p) for networking, GORM with `postgres` driver, Gorilla WebSocket for real-time communication
- PostgreSQL schema auto-migrates on startup; monthly partitions created proactively

### Runtime Behavior
- HTTP server runs on port 8080 (hardcoded in `pkg/http/server.go`)
- Database schema auto-migrates on startup
- P2P node logs connected peer count every 2 minutes
- WebSocket endpoint: `/ws`, Frontend served at `/`
- Server automatically serves React build if available, falls back to legacy HTML
- Data retention: `performance.partition_retention_months` (default 3) controls how much history is kept. A daily in-app pass (plus a synchronous pass at startup, before P2P subscribe) ensures current+next partitions exist, then routes pruning per table by its *actual* runtime shape (`pg_class.relkind`, checked per table in `deleteOldRows`): partitioned tables (`relkind='p'`) are pruned by dropping old partitions (`drop_old_partitions`); plain tables (`relkind='r'`) are pruned by batched row DELETE; a table that doesn't exist in this deployment's schema is skipped silently. `node_statuses` is always partitioned; the remaining message tables (`blocks`, `block_headers`, `handshakes`, `mining_ons`, `subtrees`, `best_block_requests`) are checked individually since PROD has them plain while `migrations/001`/local docker have them partitioned. `rejected_txes` was removed and is dropped on startup.

### Frontend Architecture
- **React/TypeScript**: Modern component-based architecture
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Custom Hooks**: `useWebSocket` for real-time connection management
- **API Service**: Centralized HTTP client for backend communication
- **Real-time Updates**: WebSocket integration with visual indicators for new messages

### Security Considerations
- Passive listener: `dht_mode: "off"`, no DHT participation, no peer advertisement. Bootstrap discovery via `/dnsaddr` (BSV Association-managed)
- No authentication/authorization implemented for HTTP endpoints
- PostgreSQL credentials live in `config.yaml` — do not commit production credentials

### Hidden Features
- **All Networks Selection**: The frontend supports viewing messages from all networks simultaneously, but this option is currently hidden from the UI. The functionality remains fully implemented in the codebase and can be re-enabled by uncommenting the "All Networks" button in `frontend-react/src/components/NetworkSelector.tsx`. The default network selection is set to 'mainnet'.