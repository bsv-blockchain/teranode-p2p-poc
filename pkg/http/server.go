package http

import (
	"encoding/json"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/parser"
	tWebsocket "github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"net/http"
	"os"
	"strconv"
)

// CORS middleware to handle Cross-Origin Resource Sharing
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "86400")

		// Handle preflight OPTIONS requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Call the next handler
		next(w, r)
	}
}

func InitServer(log *logrus.Logger, db *gorm.DB) {
	// Set up static file serving for React app
	staticFS := http.FileServer(http.Dir("./frontend-react/build"))
	
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Skip API endpoints
		if r.URL.Path == "/ws" || 
		   r.URL.Path == "/messages" || 
		   r.URL.Path == "/blocks" || 
		   r.URL.Path == "/mining" || 
		   r.URL.Path == "/subtrees" || 
		   r.URL.Path == "/handshakes" || 
		   r.URL.Path == "/rejected-tx" ||
		   r.URL.Path == "/networks" ||
		   r.URL.Path == "/message-types" {
			return
		}
		
		// Check if the requested file exists
		path := "./frontend-react/build" + r.URL.Path
		if _, err := os.Stat(path); err == nil {
			// File exists, serve it
			staticFS.ServeHTTP(w, r)
			return
		}
		
		// For any non-existent path, serve index.html (for React Router)
		// This enables client-side routing
		if _, err := os.Stat("./frontend-react/build/index.html"); err == nil {
			http.ServeFile(w, r, "./frontend-react/build/index.html")
		} else {
			// Fallback to legacy frontend if React build doesn't exist
			http.ServeFile(w, r, "./frontend/index.html")
		}
	})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		upgrader := websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		tWebsocket.WsClients.Mu.Lock()
		tWebsocket.WsClients.Conns[conn] = true
		tWebsocket.WsClients.Mu.Unlock()
		for {
			// Just read to detect disconnects
			if _, _, err := conn.NextReader(); err != nil {
				tWebsocket.WsClients.Mu.Lock()
				delete(tWebsocket.WsClients.Conns, conn)
				tWebsocket.WsClients.Mu.Unlock()
				conn.Close()
				break
			}
		}
	})

	http.HandleFunc("/messages", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		topic := r.URL.Query().Get("topic")
		peer := r.URL.Query().Get("peer")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 {
				if n > 500 {
					limit = 500
				} else {
					limit = n
				}
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var messages []model.Message
		query := db.Order("received_at asc").Limit(limit).Offset(offset)
		if topic != "" {
			query = query.Where("topic = ?", topic)
		}
		if peer != "" {
			query = query.Where("peer = ?", peer)
		}
		if err := query.Find(&messages).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Database error: " + err.Error()))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	}))

	// Blocks endpoint
	http.HandleFunc("/blocks", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		peerID := r.URL.Query().Get("peer_id")
		hash := r.URL.Query().Get("hash")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var blocks []model.Block
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if peerID != "" {
			query = query.Where("peer_id = ?", peerID)
		}
		if hash != "" {
			query = query.Where("hash = ?", hash)
		}
		if err := query.Find(&blocks).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(blocks)
	}))

	// Mining messages endpoint
	http.HandleFunc("/mining", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		miner := r.URL.Query().Get("miner")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var miningMsgs []model.MiningOn
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if miner != "" {
			query = query.Where("miner = ?", miner)
		}
		if err := query.Find(&miningMsgs).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(miningMsgs)
	}))

	// Subtrees endpoint
	http.HandleFunc("/subtrees", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		hash := r.URL.Query().Get("hash")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var subtrees []model.Subtree
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if hash != "" {
			query = query.Where("hash = ?", hash)
		}
		if err := query.Find(&subtrees).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(subtrees)
	}))

	// Handshakes endpoint
	http.HandleFunc("/handshakes", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		messageType := r.URL.Query().Get("type")
		peerID := r.URL.Query().Get("peer_id")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var handshakes []model.Handshake
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if messageType != "" {
			query = query.Where("type = ?", messageType)
		}
		if peerID != "" {
			query = query.Where("peer_id = ?", peerID)
		}
		if err := query.Find(&handshakes).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(handshakes)
	}))

	// Rejected transactions endpoint
	http.HandleFunc("/rejected-tx", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		txID := r.URL.Query().Get("tx_id")
		limit := 100
		offset := 0

		if l := r.URL.Query().Get("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		if o := r.URL.Query().Get("offset"); o != "" {
			if n, err := strconv.Atoi(o); err == nil && n >= 0 {
				offset = n
			}
		}

		var rejectedTxs []model.RejectedTx
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if txID != "" {
			query = query.Where("tx_id = ?", txID)
		}
		if err := query.Find(&rejectedTxs).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rejectedTxs)
	}))

	// Networks endpoint - returns available networks
	http.HandleFunc("/networks", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		networks := parser.GetNetworks()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(networks)
	}))

	// Message types endpoint - returns available message types
	http.HandleFunc("/message-types", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		messageTypes := parser.GetMessageTypes()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messageTypes)
	}))

	addr := ":8080"
	log.Infof("HTTP message query server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Errorf("HTTP server error: %v", err)
	}
}
