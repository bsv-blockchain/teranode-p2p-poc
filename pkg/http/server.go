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
	// WebSocket endpoint
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
		// Also support peer_id parameter for consistency with other endpoints
		if peer == "" {
			peer = r.URL.Query().Get("peer_id")
		}
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
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
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

		type PeerSummary struct {
			PeerID        string `json:"peerID"`
			MessageCount  int64  `json:"messageCount"`
			LastSeen      string `json:"lastSeen"`
		}

		type Stats struct {
			TotalMessages     int64             `json:"totalMessages"`
			UniqueTopics      int               `json:"uniqueTopics"`
			UniquePeers       int               `json:"uniquePeers"`
			MessagesToday     int64             `json:"messagesToday"`
			LatestBlockHeight map[string]uint32 `json:"latestBlockHeight"`
			LastMessageTime   *string           `json:"lastMessageTime,omitempty"`
			TopicStats        []TopicStat       `json:"topicStats"`
			TopPeers          []PeerSummary     `json:"topPeers"`
		}

		stats := Stats{
			LatestBlockHeight: make(map[string]uint32),
			TopicStats:        []TopicStat{},
			TopPeers:          []PeerSummary{},
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
					topic := "bitcoin/" + nc.Network + "-miningon"
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
							MessageType:  "miningon",
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

		// Get top 10 most active peers
		type PeerActivity struct {
			PeerID       string
			MessageCount int64
			LastSeen     string
		}
		var topPeersList []PeerActivity
		
		// Get peer activity from messages table
		if err := db.Table("messages").
			Select("peer as peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen").
			Where("peer != ''").
			Group("peer").
			Order("message_count DESC").
			Limit(10).
			Find(&topPeersList).Error; err == nil {
			
			// Also check specialized tables for these peers to get accurate counts
			for i, peer := range topPeersList {
				// Count messages from specialized tables
				var additionalCount int64
				
				var blockCount int64
				db.Table("blocks").Where("peer_id = ?", peer.PeerID).Count(&blockCount)
				additionalCount += blockCount
				
				var miningCount int64
				db.Table("mining_ons").Where("peer_id = ?", peer.PeerID).Count(&miningCount)
				additionalCount += miningCount
				
				var subtreeCount int64
				db.Table("subtrees").Where("peer_id = ?", peer.PeerID).Count(&subtreeCount)
				additionalCount += subtreeCount
				
				var handshakeCount int64
				db.Table("handshakes").Where("peer_id = ?", peer.PeerID).Count(&handshakeCount)
				additionalCount += handshakeCount
				
				var rejectedCount int64
				db.Table("rejected_txes").Where("peer_id = ?", peer.PeerID).Count(&rejectedCount)
				additionalCount += rejectedCount
				
				topPeersList[i].MessageCount += additionalCount
				
				// Update last seen time from all tables
				var lastSeenTime time.Time
				checkLastSeen := func(table string) {
					var tableTime time.Time
					if err := db.Table(table).
						Select("MAX(received_at) as received_at").
						Where("peer_id = ?", peer.PeerID).
						Row().Scan(&tableTime); err == nil && tableTime.After(lastSeenTime) {
						lastSeenTime = tableTime
					}
				}
				
				checkLastSeen("blocks")
				checkLastSeen("mining_ons")
				checkLastSeen("subtrees")
				checkLastSeen("handshakes")
				checkLastSeen("rejected_txes")
				
				// Parse the existing last seen time - try multiple formats
				var existingLastSeen time.Time
				timeFormats := []string{
					"2006-01-02 15:04:05",
					"2006-01-02T15:04:05Z",
					"2006-01-02T15:04:05",
					time.RFC3339,
				}
				for _, format := range timeFormats {
					if t, err := time.Parse(format, topPeersList[i].LastSeen); err == nil {
						existingLastSeen = t
						break
					}
				}
				if lastSeenTime.After(existingLastSeen) {
					topPeersList[i].LastSeen = lastSeenTime.Format("2006-01-02 15:04:05")
				}
			}
			
			// Sort again by total message count
			sort.Slice(topPeersList, func(i, j int) bool {
				return topPeersList[i].MessageCount > topPeersList[j].MessageCount
			})
			
			// Convert to PeerSummary format
			for _, peer := range topPeersList {
				// Parse the LastSeen string and format as RFC3339
				var lastSeenTime time.Time
				timeFormats := []string{
					"2006-01-02 15:04:05",
					"2006-01-02T15:04:05Z",
					"2006-01-02T15:04:05",
					time.RFC3339,
				}
				for _, format := range timeFormats {
					if t, err := time.Parse(format, peer.LastSeen); err == nil {
						lastSeenTime = t
						break
					}
				}
				stats.TopPeers = append(stats.TopPeers, PeerSummary{
					PeerID:       peer.PeerID,
					MessageCount: peer.MessageCount,
					LastSeen:     lastSeenTime.Format(time.RFC3339),
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}))

	// Peers endpoint - returns list of peers with statistics
	http.HandleFunc("/peers", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		type PeerStat struct {
			PeerID          string    `json:"peerID"`
			TotalMessages   int64     `json:"totalMessages"`
			FirstSeen       time.Time `json:"firstSeen"`
			LastSeen        time.Time `json:"lastSeen"`
			Networks        []string  `json:"networks"`
			MessageTypes    map[string]int64 `json:"messageTypes"`
			LastUserAgent   string    `json:"lastUserAgent,omitempty"`
			LastBestHeight  uint32    `json:"lastBestHeight,omitempty"`
		}

		// Get all unique peers
		peerMap := make(map[string]*PeerStat)
		
		// Collect peers from messages table
		type PeerInfo struct {
			Peer      string
			Count     int64
			FirstSeen string
			LastSeen  string
		}
		var messagePeers []PeerInfo
		if err := db.Table("messages").
			Select("peer, COUNT(*) as count, MIN(received_at) as first_seen, MAX(received_at) as last_seen").
			Where("peer != ''").
			Group("peer").
			Find(&messagePeers).Error; err == nil {
			for _, p := range messagePeers {
				// Parse time strings - try multiple formats
				var firstSeen, lastSeen time.Time
				var err error
				
				// Try different time formats that SQLite might return
				timeFormats := []string{
					"2006-01-02 15:04:05",
					"2006-01-02T15:04:05Z",
					"2006-01-02T15:04:05",
					time.RFC3339,
				}
				
				for _, format := range timeFormats {
					if firstSeen, err = time.Parse(format, p.FirstSeen); err == nil {
						break
					}
				}
				if err != nil {
					firstSeen = time.Now() // fallback
				}
				
				for _, format := range timeFormats {
					if lastSeen, err = time.Parse(format, p.LastSeen); err == nil {
						break
					}
				}
				if err != nil {
					lastSeen = time.Now() // fallback
				}
				
				peerMap[p.Peer] = &PeerStat{
					PeerID:        p.Peer,
					TotalMessages: p.Count,
					FirstSeen:     firstSeen,
					LastSeen:      lastSeen,
					Networks:      []string{},
					MessageTypes:  make(map[string]int64),
				}
			}
		}

		// Add data from specialized tables
		// Blocks
		type PeerTableInfo struct {
			PeerID    string
			Network   string
			Count     int64
			FirstSeen string
			LastSeen  string
		}
		
		// Helper function to process specialized tables
		processPeerTable := func(tableName, messageType string) {
			var peers []PeerTableInfo
			if err := db.Table(tableName).
				Select("peer_id, network, COUNT(*) as count, MIN(received_at) as first_seen, MAX(received_at) as last_seen").
				Where("peer_id != ''").
				Group("peer_id, network").
				Find(&peers).Error; err == nil {
				for _, p := range peers {
					// Parse time strings - try multiple formats
					var firstSeen, lastSeen time.Time
					var err error
					
					// Try different time formats that SQLite might return
					timeFormats := []string{
						"2006-01-02 15:04:05",
						"2006-01-02T15:04:05Z",
						"2006-01-02T15:04:05",
						time.RFC3339,
					}
					
					for _, format := range timeFormats {
						if firstSeen, err = time.Parse(format, p.FirstSeen); err == nil {
							break
						}
					}
					if err != nil {
						firstSeen = time.Now() // fallback
					}
					
					for _, format := range timeFormats {
						if lastSeen, err = time.Parse(format, p.LastSeen); err == nil {
							break
						}
					}
					if err != nil {
						lastSeen = time.Now() // fallback
					}
					
					if stat, exists := peerMap[p.PeerID]; exists {
						stat.TotalMessages += p.Count
						stat.MessageTypes[messageType] = stat.MessageTypes[messageType] + p.Count
						if firstSeen.Before(stat.FirstSeen) {
							stat.FirstSeen = firstSeen
						}
						if lastSeen.After(stat.LastSeen) {
							stat.LastSeen = lastSeen
						}
						// Add network if not already present
						networkExists := false
						for _, n := range stat.Networks {
							if n == p.Network {
								networkExists = true
								break
							}
						}
						if !networkExists && p.Network != "" {
							stat.Networks = append(stat.Networks, p.Network)
						}
					} else {
						// Create new peer entry
						peerMap[p.PeerID] = &PeerStat{
							PeerID:        p.PeerID,
							TotalMessages: p.Count,
							FirstSeen:     firstSeen,
							LastSeen:      lastSeen,
							Networks:      []string{},
							MessageTypes:  make(map[string]int64),
						}
						if p.Network != "" {
							peerMap[p.PeerID].Networks = []string{p.Network}
						}
						peerMap[p.PeerID].MessageTypes[messageType] = p.Count
					}
				}
			}
		}

		// Process all message type tables
		processPeerTable("blocks", "block")
		processPeerTable("mining_ons", "miningon")
		processPeerTable("subtrees", "subtree")
		processPeerTable("handshakes", "handshake")
		processPeerTable("rejected_txes", "rejected_tx")

		// Get latest handshake info for each peer
		// Use a subquery approach that works with SQLite
		for peerID := range peerMap {
			var handshake model.Handshake
			if err := db.Table("handshakes").
				Where("peer_id = ?", peerID).
				Order("received_at DESC").
				First(&handshake).Error; err == nil {
				if stat, exists := peerMap[peerID]; exists {
					stat.LastUserAgent = handshake.UserAgent
					stat.LastBestHeight = handshake.BestHeight
				}
			}
		}

		// Convert map to slice and sort by total messages
		peers := make([]PeerStat, 0, len(peerMap))
		for _, peer := range peerMap {
			// Sort networks
			sort.Strings(peer.Networks)
			peers = append(peers, *peer)
		}
		
		// Sort peers by total messages descending
		sort.Slice(peers, func(i, j int) bool {
			return peers[i].TotalMessages > peers[j].TotalMessages
		})

		// Apply pagination if requested
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

		// Apply pagination
		totalPeers := len(peers)
		if offset < len(peers) {
			end := offset + limit
			if end > len(peers) {
				end = len(peers)
			}
			peers = peers[offset:end]
		} else {
			peers = []PeerStat{}
		}

		// Return response with metadata
		response := map[string]interface{}{
			"peers":      peers,
			"totalPeers": totalPeers,
			"limit":      limit,
			"offset":     offset,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))

	// Peer detail endpoint - returns detailed info for a specific peer
	http.HandleFunc("/peers/", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		// Extract peer ID from path
		peerID := strings.TrimPrefix(r.URL.Path, "/peers/")
		if peerID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Peer ID required"})
			return
		}

		type PeerDetail struct {
			PeerID        string                 `json:"peerID"`
			TotalMessages int64                  `json:"totalMessages"`
			FirstSeen     time.Time              `json:"firstSeen"`
			LastSeen      time.Time              `json:"lastSeen"`
			Networks      []string               `json:"networks"`
			MessageTypes  map[string]int64       `json:"messageTypes"`
			Handshakes    []model.Handshake      `json:"handshakes"`
			RecentBlocks  []model.Block          `json:"recentBlocks"`
			RecentMining  []model.MiningOn       `json:"recentMining"`
			TimeStats     map[string]interface{} `json:"timeStats"`
		}

		detail := PeerDetail{
			PeerID:       peerID,
			Networks:     []string{},
			MessageTypes: make(map[string]int64),
			TimeStats:    make(map[string]interface{}),
			// Initialize with zero times
			FirstSeen:    time.Time{},
			LastSeen:     time.Time{},
		}

		// Parse time strings - try multiple formats
		timeFormats := []string{
			"2006-01-02 15:04:05.999999999-07:00", // SQLite datetime with timezone
			"2006-01-02 15:04:05",
			"2006-01-02T15:04:05Z",
			"2006-01-02T15:04:05",
			time.RFC3339,
		}

		// Get counts from specialized tables
		var blockCount int64
		db.Table("blocks").Where("peer_id = ?", peerID).Count(&blockCount)
		if blockCount > 0 {
			detail.MessageTypes["block"] = blockCount
			detail.TotalMessages += blockCount
		}

		var miningCount int64
		db.Table("mining_ons").Where("peer_id = ?", peerID).Count(&miningCount)
		if miningCount > 0 {
			detail.MessageTypes["miningon"] = miningCount
			detail.TotalMessages += miningCount
		}

		var subtreeCount int64
		db.Table("subtrees").Where("peer_id = ?", peerID).Count(&subtreeCount)
		if subtreeCount > 0 {
			detail.MessageTypes["subtree"] = subtreeCount
			detail.TotalMessages += subtreeCount
		}

		var handshakeCount int64
		db.Table("handshakes").Where("peer_id = ?", peerID).Count(&handshakeCount)
		if handshakeCount > 0 {
			detail.MessageTypes["handshake"] = handshakeCount
			detail.TotalMessages += handshakeCount
		}

		var rejectedCount int64
		db.Table("rejected_txes").Where("peer_id = ?", peerID).Count(&rejectedCount)
		if rejectedCount > 0 {
			detail.MessageTypes["rejected_tx"] = rejectedCount
			detail.TotalMessages += rejectedCount
		}

		// Get networks this peer participates in
		networkMap := make(map[string]bool)
		
		// Check each table for networks
		var networks []string
		db.Table("blocks").Where("peer_id = ? AND network != ''", peerID).Distinct("network").Pluck("network", &networks)
		for _, n := range networks {
			networkMap[n] = true
		}
		
		db.Table("mining_ons").Where("peer_id = ? AND network != ''", peerID).Distinct("network").Pluck("network", &networks)
		for _, n := range networks {
			networkMap[n] = true
		}

		db.Table("subtrees").Where("peer_id = ? AND network != ''", peerID).Distinct("network").Pluck("network", &networks)
		for _, n := range networks {
			networkMap[n] = true
		}

		db.Table("handshakes").Where("peer_id = ? AND network != ''", peerID).Distinct("network").Pluck("network", &networks)
		for _, n := range networks {
			networkMap[n] = true
		}

		db.Table("rejected_txes").Where("peer_id = ? AND network != ''", peerID).Distinct("network").Pluck("network", &networks)
		for _, n := range networks {
			networkMap[n] = true
		}

		for network := range networkMap {
			detail.Networks = append(detail.Networks, network)
		}
		sort.Strings(detail.Networks)

		// Get all handshakes from this peer
		db.Table("handshakes").
			Where("peer_id = ?", peerID).
			Order("received_at DESC").
			Limit(10).
			Find(&detail.Handshakes)

		// Get recent blocks
		db.Table("blocks").
			Where("peer_id = ?", peerID).
			Order("received_at DESC").
			Limit(10).
			Find(&detail.RecentBlocks)

		// Get recent mining messages
		db.Table("mining_ons").
			Where("peer_id = ?", peerID).
			Order("received_at DESC").
			Limit(10).
			Find(&detail.RecentMining)

		// Calculate time-based statistics
		// Messages per hour for the last 24 hours
		twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
		type HourlyCount struct {
			Hour  string `gorm:"column:hour"`
			Count int64  `gorm:"column:count"`
		}
		var hourlyCounts []HourlyCount
		
		// This query groups messages by hour (using SQLite's strftime)
		db.Table("messages").
			Select("strftime('%Y-%m-%d %H:00:00', received_at) as hour, COUNT(*) as count").
			Where("peer = ? AND received_at > ?", peerID, twentyFourHoursAgo).
			Group("strftime('%Y-%m-%d %H:00:00', received_at)").
			Order("hour").
			Find(&hourlyCounts)

		hourlyStats := make(map[string]int64)
		for _, hc := range hourlyCounts {
			// Parse the hour string and format it
			if t, err := time.Parse("2006-01-02 15:04:05", hc.Hour); err == nil {
				hourlyStats[t.Format("2006-01-02T15:00:00Z")] = hc.Count
			} else {
				// Fallback: use the string as-is
				hourlyStats[hc.Hour] = hc.Count
			}
		}
		detail.TimeStats["hourly"] = hourlyStats

		// Update first/last seen times based on all tables
		updateTimeRange := func(tableName string) {
			var times struct {
				FirstSeen string
				LastSeen  string
			}
			var count int64
			db.Table(tableName).Where("peer_id = ?", peerID).Count(&count)
			if count > 0 {
				log.Printf("[PeerDetail] Table %s has %d records for peer %s", tableName, count, peerID)
			}
			
			if err := db.Table(tableName).
				Select("MIN(received_at) as first_seen, MAX(received_at) as last_seen").
				Where("peer_id = ?", peerID).
				Scan(&times).Error; err == nil {
				
				if times.FirstSeen != "" || times.LastSeen != "" {
					log.Printf("[PeerDetail] Table %s times for peer %s: first=%s, last=%s", 
						tableName, peerID, times.FirstSeen, times.LastSeen)
				}
				
				// Parse time strings
				var firstSeen, lastSeen time.Time
				if times.FirstSeen != "" {
					for _, format := range timeFormats {
						if t, err := time.Parse(format, times.FirstSeen); err == nil {
							firstSeen = t
							break
						}
					}
				}
				
				if times.LastSeen != "" {
					for _, format := range timeFormats {
						if t, err := time.Parse(format, times.LastSeen); err == nil {
							lastSeen = t
							break
						}
					}
				}
				
				if !firstSeen.IsZero() && (detail.FirstSeen.IsZero() || firstSeen.Before(detail.FirstSeen)) {
					log.Printf("[PeerDetail] Updating FirstSeen from %s: %v -> %v", 
						tableName, detail.FirstSeen, firstSeen)
					detail.FirstSeen = firstSeen
				}
				if !lastSeen.IsZero() && lastSeen.After(detail.LastSeen) {
					log.Printf("[PeerDetail] Updating LastSeen from %s: %v -> %v", 
						tableName, detail.LastSeen, lastSeen)
					detail.LastSeen = lastSeen
				}
			} else if err != nil {
				log.Printf("[PeerDetail] Error querying %s for peer %s: %v", tableName, peerID, err)
			}
		}

		updateTimeRange("blocks")
		updateTimeRange("mining_ons")
		updateTimeRange("subtrees")
		updateTimeRange("handshakes")
		updateTimeRange("rejected_txes")

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}))

	// Static file serving for React app - MUST be registered last
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Check if the requested file exists in React build
		path := "./frontend-react/build" + r.URL.Path
		if _, err := os.Stat(path); err == nil {
			// File exists, serve it
			http.FileServer(http.Dir("./frontend-react/build")).ServeHTTP(w, r)
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

	addr := ":8080"
	log.Infof("HTTP message query server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Errorf("HTTP server error: %v", err)
	}
}
