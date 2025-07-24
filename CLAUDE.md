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
No test files currently exist in the codebase. When adding tests, use Go's standard testing framework:
```bash
# Run tests (when they exist)
go test ./...

# Run tests with coverage
go test -cover ./...
```

## Architecture Overview

This is a BSV Blockchain P2P networking component that provides:

### Core Components
- **P2P Node** (`pkg/p2p/`): LibP2P-based peer-to-peer networking with private DHT support
- **Message Storage** (`pkg/model/`): SQLite database with GORM for message persistence
- **HTTP API** (`pkg/http/`): REST API for querying stored messages
- **WebSocket Server** (`pkg/websocket/`): Real-time message broadcasting to connected clients
- **React Frontend** (`frontend-react/`): Modern React/TypeScript application with real-time message viewing
- **Legacy Frontend** (`frontend/`): Simple HTML interface (fallback)

### Key Architecture Patterns
- **Event-Driven**: Messages received via P2P are immediately stored and broadcast via WebSocket
- **Configuration-Driven**: All settings loaded from `config.yaml` with environment variable overrides
- **Modular Design**: Each component (`pkg/`) has clear separation of concerns
- **Concurrent Processing**: HTTP server, WebSocket broadcasting, and P2P networking run in separate goroutines

### Data Flow
1. P2P node subscribes to configured topics from `config.yaml`
2. Incoming messages are stored in SQLite database
3. Messages are simultaneously broadcast to WebSocket clients
4. HTTP API provides historical message querying by topic/peer
5. Frontend provides real-time visualization and search capabilities

## Configuration

The application requires `config.yaml` with these key sections:
- `p2p`: Network configuration (bootstrap addresses, shared key, DHT protocol)
- `database`: SQLite file path
- `topics`: List of BSV Blockchain topics to subscribe to

Environment variables can override config values using `TERANODE_P2P_` prefix with underscores replacing dots.

## Important Notes

### Dependencies
- Go 1.24.5+ required
- Uses LibP2P for networking, GORM for database, Gorilla WebSocket for real-time communication
- SQLite database auto-migrates on startup

### Runtime Behavior
- HTTP server runs on port 8080 (hardcoded in `pkg/http/server.go`)
- Database schema auto-migrates on startup
- P2P node logs connected peer count every 2 minutes
- WebSocket endpoint: `/ws`, Frontend served at `/`
- Server automatically serves React build if available, falls back to legacy HTML

### Frontend Architecture
- **React/TypeScript**: Modern component-based architecture
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Custom Hooks**: `useWebSocket` for real-time connection management
- **API Service**: Centralized HTTP client for backend communication
- **Real-time Updates**: WebSocket integration with visual indicators for new messages

### Security Considerations
- Uses private DHT with shared key authentication
- No authentication/authorization implemented for HTTP endpoints
- Database path should be writable by application user