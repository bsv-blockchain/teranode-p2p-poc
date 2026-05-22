# Teranode P2P POC

Teranode P2P is a peer-to-peer networking component for the BSV Blockchain ecosystem. It now includes message persistence, a realtime websocket API, and a lightweight frontend for viewing/searching messages.

## Features

- **Decentralized Networking:** Connects to other nodes using libp2p with /dnsaddr bootstrap discovery (no DHT in this listener).
- **Configurable Topics:** Subscribes to and handles key BSV Blockchain network topics (blocks, transactions, mining status, etc.).
- **Message Persistence:** All received messages are stored in a PostgreSQL database.
- **Realtime Websocket:** All new messages are broadcast to connected websocket clients.
- **Searchable API:** Query messages by topic or peer via a REST API.
- **Lightweight Frontend:** View and search messages in realtime at `/` (served from `frontend/index.html`).

## Getting Started

### Prerequisites
- Go 1.18 or later
- [GORM](https://gorm.io/) and [gorilla/websocket](https://github.com/gorilla/websocket) (declared in `go.mod`)

### Installation
Clone the repository and ensure dependencies are installed:
```bash
git clone https://github.com/bsv-blockchain/teranode-p2p.git
cd teranode-p2p
go mod tidy
```

### Configuration

Create a `config.yaml` in your project root. Example:
```yaml
p2p:
  port: 9901
  # /dnsaddr/ entries resolve via DNS TXT to bootstrap multiaddrs.
  # Managed by BSV Association — contact BSVA to be added.
  bootstrap_peers:
    - "/dnsaddr/mainnet.bootstrap.teranode.bsvb.tech"
    - "/dnsaddr/testnet.bootstrap.teranode.bsvb.tech"
    - "/dnsaddr/teratestnet.bootstrap.teranode.bsvb.tech"
    - "/dnsaddr/tstn.bootstrap.teranode.bsvb.tech"
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
  - "tstn"
```
See `config.yaml.bk` for the full set of optional keys (`announce_addrs`, `peer_cache_file`, connection-manager tuning, Redis cache, performance, monitoring).

### Running
To start the P2P node and HTTP server:
```bash
go run main.go
```
- The HTTP server listens on port 8080 by default.
- The frontend is available at [http://localhost:8080/](http://localhost:8080/)

## API Endpoints

### Realtime Websocket
- **Endpoint:** `ws://localhost:8080/ws`
- **Description:** Receives all new messages in realtime as JSON objects.
- **Example JS usage:**
  ```js
  const ws = new WebSocket("ws://localhost:8080/ws");
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    // Render or process msg
  };
  ```

### Message Search API
- **Endpoint:** `GET /messages`
- **Query Parameters:**
  - `topic` (optional): Filter by topic
  - `peer` (optional): Filter by sender/peer
  - `limit` (optional): Max results (default 100, max 500)
  - `offset` (optional): Skip N results (default 0)
- **Response:** JSON array of messages, each with:
  - `ID`, `Topic`, `Data`, `Peer`, `ReceivedAt`
- **Example:**
  - `GET /messages?topic=bitcoin/mainnet-block&limit=20`

### Frontend
- **Location:** [http://localhost:8080/](http://localhost:8080/)
- **Features:**
  - Realtime message feed (via websocket)
  - Search/filter messages by topic or peer (via API)

## Project Structure
- `cmd/main.go`: Entry point, creates and runs the P2P node, and wires up HTTP/websocket servers.
- `pkg/http/server.go`: Implements the HTTP REST API for message search and serves the static frontend.
- `pkg/websocket/broadcast.go`: Implements the websocket server and manages broadcasting messages to clients.
- `pkg/model/message.go`: Message model for GORM/SQLite.
- `pkg/p2p/node.go`, `pkg/p2p/interface.go`, `pkg/p2p/types.go`: P2P networking core and interfaces.
- `frontend/index.html`: Lightweight UI for realtime and historical message viewing.
- `config.yaml`: Configuration file (see above).
- `go.mod`, `go.sum`: Go module dependencies.

## Example API Usage

### Search messages by topic:
```bash
curl 'http://localhost:8080/messages?topic=bitcoin/mainnet-block'
```

### Search messages by peer:
```bash
curl 'http://localhost:8080/messages?peer=peer1'
```

### Paginate results (limit & offset):
```bash
curl 'http://localhost:8080/messages?limit=10&offset=20'
```

### Combine filters:
```bash
curl 'http://localhost:8080/messages?topic=bitcoin/mainnet-block&peer=peer1&limit=5'
```

### Connect to WebSocket (JS example):
```js
const ws = new WebSocket("ws://localhost:8080/ws");
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // handle msg
};
```

### Connect to WebSocket (CLI example with wscat):
```bash
npx wscat -c ws://localhost:8080/ws
```

## Example Topics
- `bitcoin/mainnet-bestblock`
- `bitcoin/mainnet-block`
- `bitcoin/mainnet-subtree`
- `bitcoin/mainnet-mining_on`
- `bitcoin/mainnet-handshake`
- `bitcoin/mainnet-rejected_tx`

## License
This project is part of the BSV Blockchain initiative. See [BSV Blockchain License](https://bitcoinsv.io/terms-of-use/) for details.

## Credits
- BSV Blockchain community
