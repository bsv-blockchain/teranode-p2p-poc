# Teranode P2P Monitor

Public-facing read-only observer of the Teranode gossip layer on the BSV Blockchain network. Subscribes to network topics, persists what it sees to PostgreSQL, exposes a REST + WebSocket API, and ships a React dashboard.

Live at [teranode-p2p.bsvb.tech](https://teranode-p2p.bsvb.tech).

## Architecture

- **P2P listener** (`cmd/main.go`) — libp2p via `github.com/bsv-blockchain/go-p2p-message-bus`. `/dnsaddr` bootstrap, `dht_mode: "off"`. Passive listener; does not advertise.
- **Parser** (`pkg/parser`) — decodes incoming messages into typed records.
- **Batch insert service** (`pkg/service`) — buffers writes to PostgreSQL.
- **HTTP API + WebSocket** (`pkg/http`, `pkg/websocket`) — REST endpoints + `/api/ws` realtime fanout.
- **Storage** (`pkg/model`) — GORM, PostgreSQL, monthly partitions, materialized views.
- **Frontend** (`frontend-react/`) — React 19 + TypeScript + Tailwind. Dark/light theme.

## Tracked networks

`mainnet`, `testnet`, `teratestnet`. Topic types subscribed: `block`, `subtree`, `node_status`.

## Quick start

### Prerequisites
- Go 1.25.7+
- PostgreSQL (use `docker-compose -f docker-compose.postgres.yml up -d` for local stack)
- Node 18+ (for the React frontend)

### Build + run
```bash
# Boot Postgres
docker-compose -f docker-compose.postgres.yml up -d

# Build everything (Go binary + React bundle) and run
make run
```

Or step-by-step:
```bash
make install-frontend
make build-frontend
make build-go
./teranode-p2p-poc
```

Dev mode with hot reload:
```bash
make dev   # React dev server :3000 + Go API :8080
```

HTTP UI: <http://localhost:8080/>

### Configuration

`config.yaml` in the project root. Minimum viable config:

```yaml
p2p:
  port: 9901
  bootstrap_peers:
    - "/dnsaddr/mainnet.bootstrap.teranode.bsvb.tech"
    - "/dnsaddr/testnet.bootstrap.teranode.bsvb.tech"
    - "/dnsaddr/teratestnet.bootstrap.teranode.bsvb.tech"
  dht_mode: "off"

database:
  host: "localhost"
  port: 5432
  user: "teranode"
  password: "teranode"
  name: "teranode_p2p"
  sslmode: "disable"

networks:
  - "mainnet"
  - "testnet"
  - "teratestnet"
```

Full keys (`announce_addrs`, `peer_cache_file`, `max_connections`/`min_connections`, Redis cache, `performance`, `monitoring`) are documented in the checked-in `config.yaml`.

Environment overrides use the `TERANODE_P2P_` prefix with dots replaced by underscores (e.g. `TERANODE_P2P_DATABASE_HOST=postgres`).

## API

### WebSocket
- `GET /api/ws` — fan-out of every parsed message as JSON `{ ID, Topic, Data, Peer, ReceivedAt }`.

### REST
- `GET /api/messages` — generic message query (`topic`, `peer`, `limit`, `offset`)
- `GET /api/blocks` — block announcements (`network`, `peer_id`, `limit`, `offset`)
- `GET /api/subtrees` — subtree messages
- `GET /api/handshakes` — handshake messages (legacy)
- `GET /api/node-statuses` — most recent node status per peer (`network`, `peer_id`, `limit`)
- `GET /api/block-headers` — parsed block headers (`network`, `hash`, `height`, `min_height`, `max_height`, etc.)
- `GET /api/peers` — peer aggregate stats
- `GET /api/peers/:peerID` — single-peer detail (message counts, recent activity, networks, time range)
- `GET /api/networks` — network list
- `GET /api/message-types` — message type list
- `GET /api/stats` — aggregate counts, top topics, top peers, latest block heights

All endpoints CORS-enabled.

## Frontend

Path: `frontend-react/`. CRA + TypeScript + Tailwind + react-router. Build output goes to `frontend-react/build/` and is served by the Go binary in production.

Pages:
- `/` — Teranode overview (per-network node grid, sync state, blocks/hr, lag)
- `/networks` — Per-network node table
- `/peers`, `/peers/:peerID` — Peer list + detail
- `/stats` — Aggregate network statistics

Theme toggle (sun/moon) in the top nav. Persisted to `localStorage`.

## Project layout

```
cmd/main.go                       # entrypoint
pkg/
  http/                           # REST + WS server
  model/                          # GORM models (PostgreSQL)
  parser/                         # topic parser
  service/                        # batch insert, stats
  websocket/                      # fan-out broadcaster
  p2p/                            # libp2p wrapper
frontend-react/                   # React dashboard
k8s/                              # Kubernetes manifests
config.yaml                       # default config
docker-compose.yml                # app + deps for compose run
docker-compose.postgres.yml       # postgres-only for local dev
Dockerfile                        # multi-stage build (React + Go)
```

## Docker / Kubernetes

See [DOCKER.md](DOCKER.md) for build, compose, and k8s deployment instructions. PostgreSQL setup notes in [POSTGRES_SETUP.md](POSTGRES_SETUP.md).

## Maintainer

Built and maintained by the [BSV Association](https://www.bsvblockchain.org/).
