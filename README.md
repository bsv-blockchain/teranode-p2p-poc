# Teranode P2P

Teranode P2P is a peer-to-peer networking component for the Bitcoin SV Teranode project. It now includes message persistence, a realtime websocket API, and a lightweight frontend for viewing/searching messages.

## Features

- **Decentralized Networking:** Connects to other Teranode nodes using a secure, private DHT (Distributed Hash Table).
- **Configurable Topics:** Subscribes to and handles key Bitcoin SV network topics (blocks, transactions, mining status, etc.).
- **Message Persistence:** All received messages are stored in a SQLite database (configurable path).
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
git clone https://github.com/bitcoin-sv/teranode-p2p.git
cd teranode-p2p
go mod tidy
```

### Configuration

Create a `config.yaml` in your project root. Example:
```yaml
database:
  path: "./messages.db"
p2p:
  bootstrap_addresses:
    - "address1"
    - "address2"
  shared_key: "your-shared-key"
  dht_protocol_id: "your-protocol-id"
  port: 12345
  listen_addresses:
    - "/ip4/0.0.0.0/tcp/12345"
  advertise: true
  use_private_dht: true
topics:
  - "bitcoin/mainnet-block"
  - "bitcoin/mainnet-tx"
```
- **database.path**: Path to your SQLite database file.
- **topics**: List of topics to subscribe to.
- Other `p2p` keys as needed for your network.

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
- `main.go`: Entry point, creates and runs the P2P node.
- `go.mod`, `go.sum`: Go module dependencies.

## Example Topics
- `bitcoin/mainnet-bestblock`
- `bitcoin/mainnet-block`
- `bitcoin/mainnet-subtree`
- `bitcoin/mainnet-mining_on`
- `bitcoin/mainnet-handshake`
- `bitcoin/mainnet-rejected_tx`

## License
This project is part of the Bitcoin SV Teranode initiative. See [Bitcoin SV License](https://bitcoinsv.io/terms-of-use/) for details.

## Credits
- [Bitcoin SV Teranode](https://github.com/bitcoin-sv/teranode)
- BSV Blockchain community
