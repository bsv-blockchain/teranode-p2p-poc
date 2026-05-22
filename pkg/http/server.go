package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/parser"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/service"
	tWebsocket "github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
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

func InitServer(log *logrus.Logger, db *gorm.DB, statsService *service.StatsService) {
	// WebSocket endpoint
	http.HandleFunc("/api/ws", func(w http.ResponseWriter, r *http.Request) {
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

	http.HandleFunc("/api/messages", enableCORS(func(w http.ResponseWriter, r *http.Request) {
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

		// Since we now use specialized tables, we need to gather messages from each table
		type GenericMessage struct {
			ID         uint      `json:"ID"`
			Topic      string    `json:"Topic"`
			Data       string    `json:"Data"`
			Network    string    `json:"Network"`
			PeerID     string    `json:"PeerID"`
			ReceivedAt time.Time `json:"ReceivedAt"`
		}

		var messages []GenericMessage

		// Determine which table(s) to query based on topic
		if topic != "" {
			// Extract message type from topic
			parts := strings.Split(topic, "-")
			if len(parts) >= 2 {
				messageType := parts[len(parts)-1]
				network := strings.Join(parts[:len(parts)-1], "-")

				switch messageType {
				case "block":
					var blocks []model.Block
					query := db.Table("blocks").Order("received_at DESC").Limit(limit).Offset(offset)
					if peer != "" {
						query = query.Where("peer_id = ?", peer)
					}
					if network != "" {
						query = query.Where("network = ?", network)
					}
					if err := query.Find(&blocks).Error; err == nil {
						for _, b := range blocks {
							data, _ := json.Marshal(b)
							messages = append(messages, GenericMessage{
								ID:         uint(b.ID),
								Topic:      topic,
								Data:       string(data),
								Network:    b.Network,
								PeerID:     b.PeerID,
								ReceivedAt: b.ReceivedAt,
							})
						}
					}

				case "subtree":
					var subtrees []model.Subtree
					query := db.Table("subtrees").Order("received_at DESC").Limit(limit).Offset(offset)
					if peer != "" {
						query = query.Where("peer_id = ?", peer)
					}
					if network != "" {
						query = query.Where("network = ?", network)
					}
					if err := query.Find(&subtrees).Error; err == nil {
						for _, s := range subtrees {
							data, _ := json.Marshal(s)
							messages = append(messages, GenericMessage{
								ID:         uint(s.ID),
								Topic:      topic,
								Data:       string(data),
								Network:    s.Network,
								PeerID:     s.PeerID,
								ReceivedAt: s.ReceivedAt,
							})
						}
					}

				case "node_status":
					var nodeStatuses []model.NodeStatusPG
					query := db.Table("node_statuses").Order("received_at DESC").Limit(limit).Offset(offset)
					if peer != "" {
						query = query.Where("peer_id = ?", peer)
					}
					if network != "" {
						query = query.Where("network = ?", network)
					}
					if err := query.Find(&nodeStatuses).Error; err == nil {
						for _, ns := range nodeStatuses {
							data, _ := json.Marshal(ns)
							messages = append(messages, GenericMessage{
								ID:         uint(ns.ID),
								Topic:      topic,
								Data:       string(data),
								Network:    ns.Network,
								PeerID:     ns.PeerID,
								ReceivedAt: ns.ReceivedAt,
							})
						}
					}

				// We can add handshake support for backward compatibility if needed
				case "handshake":
					var handshakes []model.Handshake
					query := db.Table("handshakes").Order("received_at DESC").Limit(limit).Offset(offset)
					if peer != "" {
						query = query.Where("peer_id = ?", peer)
					}
					if network != "" {
						query = query.Where("network = ?", network)
					}
					if err := query.Find(&handshakes).Error; err == nil {
						for _, h := range handshakes {
							data, _ := json.Marshal(h)
							messages = append(messages, GenericMessage{
								ID:         uint(h.ID),
								Topic:      topic,
								Data:       string(data),
								Network:    h.Network,
								PeerID:     h.PeerID,
								ReceivedAt: h.ReceivedAt,
							})
						}
					}
				}
			}
		} else if peer != "" {
			// If only peer is specified, we need to gather from all tables
			// This is more complex, so we'll limit to the most common types

			// Get blocks
			var blocks []model.Block
			db.Table("blocks").Where("peer_id = ?", peer).Order("received_at DESC").Limit(limit/5).Find(&blocks)
			for _, b := range blocks {
				data, _ := json.Marshal(b)
				messages = append(messages, GenericMessage{
					ID:         uint(b.ID),
					Topic:      b.Network + "-block",
					Data:       string(data),
					Network:    b.Network,
					PeerID:     b.PeerID,
					ReceivedAt: b.ReceivedAt,
				})
			}

			// Get subtrees
			var subtrees []model.Subtree
			db.Table("subtrees").Where("peer_id = ?", peer).Order("received_at DESC").Limit(limit/5).Find(&subtrees)
			for _, s := range subtrees {
				data, _ := json.Marshal(s)
				messages = append(messages, GenericMessage{
					ID:         uint(s.ID),
					Topic:      s.Network + "-subtree",
					Data:       string(data),
					Network:    s.Network,
					PeerID:     s.PeerID,
					ReceivedAt: s.ReceivedAt,
				})
			}

			// Get node statuses
			var nodeStatuses []model.NodeStatusPG
			db.Table("node_statuses").Where("peer_id = ?", peer).Order("received_at DESC").Limit(limit/5).Find(&nodeStatuses)
			for _, ns := range nodeStatuses {
				data, _ := json.Marshal(ns)
				messages = append(messages, GenericMessage{
					ID:         uint(ns.ID),
					Topic:      ns.Network + "-node_status",
					Data:       string(data),
					Network:    ns.Network,
					PeerID:     ns.PeerID,
					ReceivedAt: ns.ReceivedAt,
				})
			}

			// Sort all messages by ReceivedAt descending
			sort.Slice(messages, func(i, j int) bool {
				return messages[i].ReceivedAt.After(messages[j].ReceivedAt)
			})

			// Apply limit after sorting
			if len(messages) > limit {
				messages = messages[:limit]
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	}))

	// Blocks endpoint
	http.HandleFunc("/api/blocks", enableCORS(func(w http.ResponseWriter, r *http.Request) {
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
	http.HandleFunc("/api/mining", enableCORS(func(w http.ResponseWriter, r *http.Request) {
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
	http.HandleFunc("/api/subtrees", enableCORS(func(w http.ResponseWriter, r *http.Request) {
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
	http.HandleFunc("/api/handshakes", enableCORS(func(w http.ResponseWriter, r *http.Request) {
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

	// Per-peer blocks-per-hour computed server-side from node_statuses history.
	// Aggregates (max_height - min_height) over the window per peer and normalises
	// to a 3600s baseline. Skips peers with <2 samples or <30s of span.
	http.HandleFunc("/api/peer-rates", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		windowMins := 60
		if v := r.URL.Query().Get("minutes"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 360 {
				windowMins = n
			}
		}
		since := time.Now().Add(-time.Duration(windowMins) * time.Minute)
		network := r.URL.Query().Get("network")

		type Row struct {
			PeerID        string  `json:"peer_id"`
			BlocksPerHour float64 `json:"blocks_per_hour"`
			SpanSeconds   float64 `json:"span_seconds"`
		}
		const minSpan = 30.0
		var rows []Row
		base := db.Table("node_statuses").
			Select(`peer_id,
			       CASE WHEN EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) >= ?
			            THEN (MAX(best_height) - MIN(best_height)) * 3600.0 / EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at)))
			            ELSE 0
			       END AS blocks_per_hour,
			       EXTRACT(EPOCH FROM (MAX(received_at) - MIN(received_at))) AS span_seconds`, minSpan).
			Where("received_at >= ?", since).
			Where("peer_id != ''").
			Where("best_height > 0").
			Group("peer_id").
			Having("COUNT(*) >= 2")
		if network != "" {
			base = base.Where("network = ?", network)
		}
		if err := base.Find(&rows).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rows)
	}))

	// Node statuses endpoint
	http.HandleFunc("/api/node-statuses", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
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

		var nodeStatuses []model.NodeStatusPG
		query := db.Order("received_at desc").Limit(limit).Offset(offset)
		if network != "" {
			query = query.Where("network = ?", network)
		}
		if peerID != "" {
			query = query.Where("peer_id = ?", peerID)
		}
		if err := query.Find(&nodeStatuses).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nodeStatuses)
	}))

	// Block headers endpoint
	http.HandleFunc("/api/block-headers", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		network := r.URL.Query().Get("network")
		hash := r.URL.Query().Get("hash")
		heightStr := r.URL.Query().Get("height")
		minHeightStr := r.URL.Query().Get("min_height")
		maxHeightStr := r.URL.Query().Get("max_height")
		minTimestampStr := r.URL.Query().Get("min_timestamp")
		maxTimestampStr := r.URL.Query().Get("max_timestamp")
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

		var blockHeaders []model.BlockHeader
		query := db.Order("received_at desc").Limit(limit).Offset(offset)

		if network != "" {
			query = query.Where("network = ?", network)
		}
		if hash != "" {
			query = query.Where("hash = ?", hash)
		}
		if heightStr != "" {
			if height, err := strconv.ParseUint(heightStr, 10, 32); err == nil {
				query = query.Where("height = ?", height)
			}
		}
		if minHeightStr != "" {
			if minHeight, err := strconv.ParseUint(minHeightStr, 10, 32); err == nil {
				query = query.Where("height >= ?", minHeight)
			}
		}
		if maxHeightStr != "" {
			if maxHeight, err := strconv.ParseUint(maxHeightStr, 10, 32); err == nil {
				query = query.Where("height <= ?", maxHeight)
			}
		}
		if minTimestampStr != "" {
			if minTimestamp, err := strconv.ParseInt(minTimestampStr, 10, 64); err == nil {
				query = query.Where("timestamp >= ?", minTimestamp)
			}
		}
		if maxTimestampStr != "" {
			if maxTimestamp, err := strconv.ParseInt(maxTimestampStr, 10, 64); err == nil {
				query = query.Where("timestamp <= ?", maxTimestamp)
			}
		}

		if err := query.Find(&blockHeaders).Error; err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(blockHeaders)
	}))

	// Networks endpoint - returns available networks
	http.HandleFunc("/api/networks", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		networks := parser.GetNetworks()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(networks)
	}))

	// Message types endpoint - returns available message types
	http.HandleFunc("/api/message-types", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		messageTypes := parser.GetMessageTypes()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messageTypes)
	}))

	// Stats endpoint - returns message statistics from cache
	http.HandleFunc("/api/stats", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		type TopicStat struct {
			Topic        string `json:"topic"`
			MessageCount int64  `json:"messageCount"`
			Network      string `json:"network,omitempty"`
			MessageType  string `json:"messageType,omitempty"`
		}

		type PeerSummary struct {
			PeerID       string `json:"peerID"`
			MessageCount int64  `json:"messageCount"`
			LastSeen     string `json:"lastSeen"`
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
			CacheAge          int64             `json:"cacheAge"`          // Age of cache in seconds
			CalculationTimeMs int64             `json:"calculationTimeMs"` // Time taken to calculate
		}

		// Try to get cached stats first
		cachedStats, err := statsService.GetCachedStats()
		if err != nil || cachedStats == nil {
			// No cached stats available, return error
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": "Statistics are being calculated. Please try again in a few seconds.",
			})
			return
		}

		// Parse cached data
		stats := Stats{
			TotalMessages:     cachedStats.TotalMessages,
			UniqueTopics:      cachedStats.UniqueTopics,
			UniquePeers:       cachedStats.UniquePeers,
			MessagesToday:     cachedStats.MessagesToday,
			LatestBlockHeight: make(map[string]uint32),
			TopicStats:        []TopicStat{},
			TopPeers:          []PeerSummary{},
			CalculationTimeMs: cachedStats.CalculationTimeMs,
			CacheAge:          int64(time.Since(cachedStats.CalculatedAt).Seconds()),
		}

		// Parse JSON fields
		if cachedStats.LatestBlockHeights != "" {
			json.Unmarshal([]byte(cachedStats.LatestBlockHeights), &stats.LatestBlockHeight)
		}

		if cachedStats.TopicStats != "" {
			json.Unmarshal([]byte(cachedStats.TopicStats), &stats.TopicStats)
		}

		if cachedStats.TopPeers != "" {
			json.Unmarshal([]byte(cachedStats.TopPeers), &stats.TopPeers)
		}

		if cachedStats.LastMessageTime != nil {
			timeStr := cachedStats.LastMessageTime.Format(time.RFC3339)
			stats.LastMessageTime = &timeStr
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
	}))

	// Peers endpoint - returns list of peers with statistics
	http.HandleFunc("/api/peers", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		type PeerStat struct {
			PeerID         string           `json:"peerID"`
			TotalMessages  int64            `json:"totalMessages"`
			FirstSeen      time.Time        `json:"firstSeen"`
			LastSeen       time.Time        `json:"lastSeen"`
			Networks       []string         `json:"networks"`
			MessageTypes   map[string]int64 `json:"messageTypes"`
			LastUserAgent  string           `json:"lastUserAgent,omitempty"`
			LastBestHeight uint32           `json:"lastBestHeight,omitempty"`
		}

		// Get all unique peers
		peerMap := make(map[string]*PeerStat)

		// Skip querying the non-existent messages table - the database has been optimized
		// to use specialized tables (blocks, subtrees, node_statuses)

		// Add data from specialized tables
		// Blocks
		type PeerTableInfo struct {
			PeerID    string
			Network   string
			Count     int64
			FirstSeen string
			LastSeen  string
		}

		// Optimized helper function to process specialized tables with less memory overhead
		processPeerTable := func(tableName, messageType string) {
			var peers []PeerTableInfo
			// Use raw SQL for better performance with large datasets
			query := fmt.Sprintf(`
				SELECT peer_id, network, COUNT(*) as count,
				       MIN(received_at) as first_seen,
				       MAX(received_at) as last_seen
				FROM %s
				WHERE peer_id != ''
				GROUP BY peer_id, network`, tableName)

			if err := db.Raw(query).Scan(&peers).Error; err == nil {
				for _, p := range peers {
					// Use Go's built-in time parsing which handles SQLite format
					var firstSeen, lastSeen time.Time

					// SQLite returns timestamps in RFC3339 format by default
					firstSeen, _ = time.Parse(time.RFC3339, p.FirstSeen)
					if firstSeen.IsZero() {
						firstSeen, _ = time.Parse("2006-01-02 15:04:05", p.FirstSeen)
					}
					if firstSeen.IsZero() {
						firstSeen = time.Now()
					}

					lastSeen, _ = time.Parse(time.RFC3339, p.LastSeen)
					if lastSeen.IsZero() {
						lastSeen, _ = time.Parse("2006-01-02 15:04:05", p.LastSeen)
					}
					if lastSeen.IsZero() {
						lastSeen = time.Now()
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
			} else if err != nil {
				logrus.Printf("Error querying %s table for peer stats: %v", tableName, err)
			}
		}

		// Process all message type tables
		processPeerTable("blocks", "block")
		processPeerTable("subtrees", "subtree")
		processPeerTable("node_statuses", "node_status")

		// Get latest user agent and best height from node_statuses for each peer
		type NodeStatusInfo struct {
			PeerID      string
			UserAgent   string
			BestHeight  uint32
		}
		var nodeStatuses []NodeStatusInfo
		query := `
			SELECT DISTINCT ON (peer_id)
			       peer_id,
			       user_agent,
			       best_height
			FROM node_statuses
			WHERE peer_id != ''
			ORDER BY peer_id, received_at DESC`

		if db.Dialector.Name() == "sqlite" {
			// SQLite doesn't support DISTINCT ON, use a different approach
			query = `
				SELECT peer_id, user_agent, best_height
				FROM node_statuses ns1
				WHERE peer_id != ''
				  AND received_at = (
				    SELECT MAX(received_at)
				    FROM node_statuses ns2
				    WHERE ns2.peer_id = ns1.peer_id
				  )`
		}

		if err := db.Raw(query).Scan(&nodeStatuses).Error; err == nil {
			for _, ns := range nodeStatuses {
				if stat, exists := peerMap[ns.PeerID]; exists {
					stat.LastUserAgent = ns.UserAgent
					stat.LastBestHeight = ns.BestHeight
				}
			}
		} else {
			logrus.Printf("Error querying node_statuses for user agent and best height: %v", err)
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
	http.HandleFunc("/api/peers/", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		// Extract peer ID from path
		peerID := strings.TrimPrefix(r.URL.Path, "/api/peers/")
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
			Handshakes    []model.Handshake      `json:"handshakes"`    // Deprecated - kept for compatibility
			NodeStatuses  []model.NodeStatusPG   `json:"nodeStatuses"`
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
			FirstSeen: time.Time{},
			LastSeen:  time.Time{},
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

		// Handshake count (deprecated but kept for compatibility)
		var handshakeCount int64
		db.Table("handshakes").Where("peer_id = ?", peerID).Count(&handshakeCount)
		if handshakeCount > 0 {
			detail.MessageTypes["handshake"] = handshakeCount
			detail.TotalMessages += handshakeCount
		}

		// Node status count
		var nodeStatusCount int64
		db.Table("node_statuses").Where("peer_id = ?", peerID).Count(&nodeStatusCount)
		if nodeStatusCount > 0 {
			detail.MessageTypes["node_status"] = nodeStatusCount
			detail.TotalMessages += nodeStatusCount
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

		for network := range networkMap {
			detail.Networks = append(detail.Networks, network)
		}
		sort.Strings(detail.Networks)

		// Get all handshakes from this peer (deprecated - kept for compatibility)
		db.Table("handshakes").
			Where("peer_id = ?", peerID).
			Order("received_at DESC").
			Limit(10).
			Find(&detail.Handshakes)

		// Get recent node status updates from this peer
		db.Table("node_statuses").
			Where("peer_id = ?", peerID).
			Order("received_at DESC").
			Limit(10).
			Find(&detail.NodeStatuses)

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
