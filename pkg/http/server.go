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
	"sort"
	"strconv"
	"strings"
	"time"
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
		   r.URL.Path == "/message-types" ||
		   r.URL.Path == "/stats" {
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

	// Stats endpoint - returns message statistics
	http.HandleFunc("/stats", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		type TopicStat struct {
			Topic       string `json:"topic"`
			MessageCount int64  `json:"messageCount"`
			Network     string `json:"network,omitempty"`
			MessageType string `json:"messageType,omitempty"`
		}

		type Stats struct {
			TotalMessages     int64             `json:"totalMessages"`
			UniqueTopics      int               `json:"uniqueTopics"`
			UniquePeers       int               `json:"uniquePeers"`
			MessagesToday     int64             `json:"messagesToday"`
			LatestBlockHeight map[string]uint32 `json:"latestBlockHeight"`
			LastMessageTime   *string           `json:"lastMessageTime,omitempty"`
			TopicStats        []TopicStat       `json:"topicStats"`
		}

		stats := Stats{
			LatestBlockHeight: make(map[string]uint32),
			TopicStats:        []TopicStat{},
		}

		// Count messages from all tables
		var counts []int64
		tables := []string{"messages", "blocks", "mining_ons", "subtrees", "handshakes", "rejected_txes"}
		
		for _, table := range tables {
			var count int64
			if err := db.Table(table).Count(&count).Error; err == nil {
				counts = append(counts, count)
			}
		}
		
		// Sum all counts
		for _, count := range counts {
			stats.TotalMessages += count
		}

		// Count messages from last 24 hours
		twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
		for _, table := range tables {
			var todayCount int64
			if err := db.Table(table).Where("received_at > ?", twentyFourHoursAgo).Count(&todayCount).Error; err == nil {
				stats.MessagesToday += todayCount
			}
		}

		// Get unique topics from messages table
		var topics []string
		if err := db.Table("messages").Distinct("topic").Pluck("topic", &topics).Error; err == nil {
			stats.UniqueTopics = len(topics)
		}

		// Get topic statistics - count messages per topic
		type TopicCount struct {
			Topic string
			Count int64
		}
		var topicCounts []TopicCount
		if err := db.Table("messages").
			Select("topic, COUNT(*) as count").
			Group("topic").
			Order("count DESC").
			Find(&topicCounts).Error; err == nil {
			for _, tc := range topicCounts {
				// Parse network and message type from topic format: bitcoin/{network}-{message_type}
				network := ""
				messageType := ""
				if len(tc.Topic) > 8 && tc.Topic[:8] == "bitcoin/" {
					parts := tc.Topic[8:]
					if dashIndex := strings.Index(parts, "-"); dashIndex > 0 {
						network = parts[:dashIndex]
						messageType = parts[dashIndex+1:]
					}
				}
				
				stats.TopicStats = append(stats.TopicStats, TopicStat{
					Topic:        tc.Topic,
					MessageCount: tc.Count,
					Network:      network,
					MessageType:  messageType,
				})
			}
		}

		// Also add counts from specialized tables for better accuracy
		// These tables store parsed messages and might have different counts
		
		// Count blocks by network
		type NetworkCount struct {
			Network string
			Count   int64
		}
		var blockCounts []NetworkCount
		if err := db.Table("blocks").
			Select("network, COUNT(*) as count").
			Group("network").
			Find(&blockCounts).Error; err == nil {
			for _, nc := range blockCounts {
				if nc.Network != "" {
					topic := "bitcoin/" + nc.Network + "-block"
					// Update existing topic stat or add new one
					found := false
					for i, ts := range stats.TopicStats {
						if ts.Topic == topic {
							stats.TopicStats[i].MessageCount = nc.Count
							found = true
							break
						}
					}
					if !found {
						stats.TopicStats = append(stats.TopicStats, TopicStat{
							Topic:        topic,
							MessageCount: nc.Count,
							Network:      nc.Network,
							MessageType:  "block",
						})
					}
				}
			}
		}

		// Count mining messages by network
		var miningCounts []NetworkCount
		if err := db.Table("mining_ons").
			Select("network, COUNT(*) as count").
			Group("network").
			Find(&miningCounts).Error; err == nil {
			for _, nc := range miningCounts {
				if nc.Network != "" {
					topic := "bitcoin/" + nc.Network + "-mining_on"
					found := false
					for i, ts := range stats.TopicStats {
						if ts.Topic == topic {
							stats.TopicStats[i].MessageCount = nc.Count
							found = true
							break
						}
					}
					if !found {
						stats.TopicStats = append(stats.TopicStats, TopicStat{
							Topic:        topic,
							MessageCount: nc.Count,
							Network:      nc.Network,
							MessageType:  "mining_on",
						})
					}
				}
			}
		}

		// Count subtrees by network
		var subtreeCounts []NetworkCount
		if err := db.Table("subtrees").
			Select("network, COUNT(*) as count").
			Group("network").
			Find(&subtreeCounts).Error; err == nil {
			for _, nc := range subtreeCounts {
				if nc.Network != "" {
					topic := "bitcoin/" + nc.Network + "-subtree"
					found := false
					for i, ts := range stats.TopicStats {
						if ts.Topic == topic {
							stats.TopicStats[i].MessageCount = nc.Count
							found = true
							break
						}
					}
					if !found {
						stats.TopicStats = append(stats.TopicStats, TopicStat{
							Topic:        topic,
							MessageCount: nc.Count,
							Network:      nc.Network,
							MessageType:  "subtree",
						})
					}
				}
			}
		}

		// Count handshakes by network
		var handshakeCounts []NetworkCount
		if err := db.Table("handshakes").
			Select("network, COUNT(*) as count").
			Group("network").
			Find(&handshakeCounts).Error; err == nil {
			for _, nc := range handshakeCounts {
				if nc.Network != "" {
					topic := "bitcoin/" + nc.Network + "-handshake"
					found := false
					for i, ts := range stats.TopicStats {
						if ts.Topic == topic {
							stats.TopicStats[i].MessageCount = nc.Count
							found = true
							break
						}
					}
					if !found {
						stats.TopicStats = append(stats.TopicStats, TopicStat{
							Topic:        topic,
							MessageCount: nc.Count,
							Network:      nc.Network,
							MessageType:  "handshake",
						})
					}
				}
			}
		}

		// Count rejected transactions by network
		var rejectedTxCounts []NetworkCount
		if err := db.Table("rejected_txes").
			Select("network, COUNT(*) as count").
			Group("network").
			Find(&rejectedTxCounts).Error; err == nil {
			for _, nc := range rejectedTxCounts {
				if nc.Network != "" {
					topic := "bitcoin/" + nc.Network + "-rejected_tx"
					found := false
					for i, ts := range stats.TopicStats {
						if ts.Topic == topic {
							stats.TopicStats[i].MessageCount = nc.Count
							found = true
							break
						}
					}
					if !found {
						stats.TopicStats = append(stats.TopicStats, TopicStat{
							Topic:        topic,
							MessageCount: nc.Count,
							Network:      nc.Network,
							MessageType:  "rejected_tx",
						})
					}
				}
			}
		}

		// Sort topic stats by message count descending
		sort.Slice(stats.TopicStats, func(i, j int) bool {
			return stats.TopicStats[i].MessageCount > stats.TopicStats[j].MessageCount
		})

		// Get unique peers from all tables
		peerMap := make(map[string]bool)
		
		// From messages table
		var messagePeers []string
		if err := db.Table("messages").Distinct("peer").Pluck("peer", &messagePeers).Error; err == nil {
			for _, peer := range messagePeers {
				if peer != "" {
					peerMap[peer] = true
				}
			}
		}
		
		// From other tables that have peer_id
		var peerIDs []string
		for _, table := range []string{"blocks", "mining_ons", "subtrees", "handshakes", "rejected_txes"} {
			if err := db.Table(table).Distinct("peer_id").Pluck("peer_id", &peerIDs).Error; err == nil {
				for _, peer := range peerIDs {
					if peer != "" {
						peerMap[peer] = true
					}
				}
			}
		}
		
		stats.UniquePeers = len(peerMap)

		// Get latest block height for each network
		var blocks []model.Block
		if err := db.Table("blocks").
			Select("network, MAX(height) as height").
			Group("network").
			Find(&blocks).Error; err == nil {
			for _, block := range blocks {
				if block.Network != "" {
					stats.LatestBlockHeight[block.Network] = block.Height
				}
			}
		}

		// Get last message time (most recent from any table)
		var lastTime time.Time
		for _, table := range tables {
			var tableTime time.Time
			if err := db.Table(table).Select("MAX(received_at) as received_at").Row().Scan(&tableTime); err == nil {
				if tableTime.After(lastTime) {
					lastTime = tableTime
				}
			}
		}
		
		if !lastTime.IsZero() {
			timeStr := lastTime.Format(time.RFC3339)
			stats.LastMessageTime = &timeStr
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}))

	addr := ":8080"
	log.Infof("HTTP message query server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Errorf("HTTP server error: %v", err)
	}
}
