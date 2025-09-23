package service

import (
	"encoding/json"
	"fmt"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
	"gorm.io/gorm"
	"sort"
	"time"
)

// StatsService handles calculating and caching statistics
type StatsService struct {
	db  *gorm.DB
	log *logrus.Logger
}

// NewStatsService creates a new stats service
func NewStatsService(db *gorm.DB, log *logrus.Logger) *StatsService {
	return &StatsService{
		db:  db,
		log: log,
	}
}

// TopicStat represents statistics for a topic
type TopicStat struct {
	Topic        string `json:"topic"`
	MessageCount int64  `json:"messageCount"`
	Network      string `json:"network,omitempty"`
	MessageType  string `json:"messageType,omitempty"`
}

// PeerSummary represents a peer's activity summary
type PeerSummary struct {
	PeerID       string `json:"peerID"`
	MessageCount int64  `json:"messageCount"`
	LastSeen     string `json:"lastSeen"`
}

// CalculateStats calculates all statistics and stores them in cache
func (s *StatsService) CalculateStats() error {
	startTime := time.Now()
	
	stats := &model.StatsCache{
		CalculatedAt: startTime,
	}
	
	// Count messages from all tables
	tables := []string{"blocks", "mining_ons", "subtrees", "handshakes", "rejected_txes", "best_block_requests"}
	tableCounts := make(map[string]int64)
	
	for _, table := range tables {
		var count int64
		if err := s.db.Table(table).Count(&count).Error; err == nil {
			tableCounts[table] = count
			stats.TotalMessages += count
		}
	}
	
	// Store table counts as JSON
	if tableCountsJSON, err := json.Marshal(tableCounts); err == nil {
		stats.MessageCountByTable = string(tableCountsJSON)
	}
	
	// Count messages from last 24 hours
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
	for _, table := range tables {
		var todayCount int64
		if err := s.db.Table(table).Where("received_at > ?", twentyFourHoursAgo).Count(&todayCount).Error; err == nil {
			stats.MessagesToday += todayCount
		}
	}
	
	// Get unique topics - PostgreSQL doesn't have a messages table, topics are handled via networks
	// Count unique networks instead
	networks := viper.GetStringSlice("networks")
	stats.UniqueTopics = len(networks)
	
	// Calculate topic statistics
	topicStats := s.calculateTopicStats()
	if topicStatsJSON, err := json.Marshal(topicStats); err == nil {
		stats.TopicStats = string(topicStatsJSON)
	}
	
	// Calculate network activity
	networkActivity := s.calculateNetworkActivity(topicStats)
	if networkActivityJSON, err := json.Marshal(networkActivity); err == nil {
		stats.NetworkActivity = string(networkActivityJSON)
	}
	
	// Get unique peers
	peerCount := s.countUniquePeers()
	stats.UniquePeers = peerCount
	
	// Get latest block heights
	latestHeights := s.getLatestBlockHeights()
	if heightsJSON, err := json.Marshal(latestHeights); err == nil {
		stats.LatestBlockHeights = string(heightsJSON)
	}
	
	// Get top peers
	topPeers := s.getTopPeers()
	if topPeersJSON, err := json.Marshal(topPeers); err == nil {
		stats.TopPeers = string(topPeersJSON)
	}
	
	// Get last message time
	lastMessageTime := s.getLastMessageTime()
	if !lastMessageTime.IsZero() {
		stats.LastMessageTime = &lastMessageTime
	}
	
	// Calculate time taken
	stats.CalculationTimeMs = time.Since(startTime).Milliseconds()
	
	// Store in database (delete old entries first)
	if err := s.db.Where("1 = 1").Delete(&model.StatsCache{}).Error; err != nil {
		return fmt.Errorf("failed to clear old stats: %w", err)
	}
	
	if err := s.db.Create(stats).Error; err != nil {
		return fmt.Errorf("failed to save stats: %w", err)
	}
	
	s.log.Infof("Statistics calculated in %dms", stats.CalculationTimeMs)
	return nil
}

// calculateTopicStats calculates message counts by topic
func (s *StatsService) calculateTopicStats() []TopicStat {
	var topicStats []TopicStat

	// Since we don't have a messages table anymore, skip the old logic
	// The specialized tables will handle all the stats

	// Add counts from specialized tables
	s.addSpecializedTableCounts(&topicStats)
	
	// Sort by message count descending
	sort.Slice(topicStats, func(i, j int) bool {
		return topicStats[i].MessageCount > topicStats[j].MessageCount
	})
	
	return topicStats
}

// addSpecializedTableCounts adds counts from specialized message tables
func (s *StatsService) addSpecializedTableCounts(topicStats *[]TopicStat) {
	// Helper to update or add topic stat
	updateOrAdd := func(topic, network, messageType string, count int64) {
		found := false
		for i, ts := range *topicStats {
			if ts.Topic == topic {
				(*topicStats)[i].MessageCount = count
				found = true
				break
			}
		}
		if !found {
			*topicStats = append(*topicStats, TopicStat{
				Topic:        topic,
				MessageCount: count,
				Network:      network,
				MessageType:  messageType,
			})
		}
	}
	
	// Count blocks by network
	type NetworkCount struct {
		Network string
		Count   int64
	}
	
	var blockCounts []NetworkCount
	if err := s.db.Table("blocks").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&blockCounts).Error; err == nil {
		for _, nc := range blockCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-block"
				updateOrAdd(topic, nc.Network, "block", nc.Count)
			}
		}
	}
	
	// Count mining messages
	var miningCounts []NetworkCount
	if err := s.db.Table("mining_ons").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&miningCounts).Error; err == nil {
		for _, nc := range miningCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-miningon"
				updateOrAdd(topic, nc.Network, "miningon", nc.Count)
			}
		}
	}
	
	// Count subtrees
	var subtreeCounts []NetworkCount
	if err := s.db.Table("subtrees").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&subtreeCounts).Error; err == nil {
		for _, nc := range subtreeCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-subtree"
				updateOrAdd(topic, nc.Network, "subtree", nc.Count)
			}
		}
	}
	
	// Count handshakes
	var handshakeCounts []NetworkCount
	if err := s.db.Table("handshakes").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&handshakeCounts).Error; err == nil {
		for _, nc := range handshakeCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-handshake"
				updateOrAdd(topic, nc.Network, "handshake", nc.Count)
			}
		}
	}
	
	// Count rejected transactions
	var rejectedTxCounts []NetworkCount
	if err := s.db.Table("rejected_txes").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&rejectedTxCounts).Error; err == nil {
		for _, nc := range rejectedTxCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-rejected_tx"
				updateOrAdd(topic, nc.Network, "rejected_tx", nc.Count)
			}
		}
	}
	
	// Count best block requests
	var bestBlockCounts []NetworkCount
	if err := s.db.Table("best_block_requests").
		Select("network, COUNT(*) as count").
		Group("network").
		Find(&bestBlockCounts).Error; err == nil {
		for _, nc := range bestBlockCounts {
			if nc.Network != "" {
				topic := "bitcoin/" + nc.Network + "-bestblock"
				updateOrAdd(topic, nc.Network, "bestblock", nc.Count)
			}
		}
	}
}

// calculateNetworkActivity calculates total messages per network
func (s *StatsService) calculateNetworkActivity(topicStats []TopicStat) map[string]int64 {
	networkActivity := make(map[string]int64)
	
	for _, ts := range topicStats {
		if ts.Network != "" {
			networkActivity[ts.Network] += ts.MessageCount
		}
	}
	
	return networkActivity
}

// countUniquePeers counts unique peers across all tables
func (s *StatsService) countUniquePeers() int {
	peerMap := make(map[string]bool)
	
	// From messages table
	var messagePeers []string
	if err := s.db.Table("messages").Distinct("peer").Pluck("peer", &messagePeers).Error; err == nil {
		for _, peer := range messagePeers {
			if peer != "" {
				peerMap[peer] = true
			}
		}
	}
	
	// From other tables (peer_id field)
	var peerIDs []string
	for _, table := range []string{"blocks", "mining_ons", "subtrees", "handshakes", "rejected_txes", "best_block_requests"} {
		peerIDs = nil
		if err := s.db.Table(table).Distinct("peer_id").Pluck("peer_id", &peerIDs).Error; err == nil {
			for _, peer := range peerIDs {
				if peer != "" {
					peerMap[peer] = true
				}
			}
		}
	}
	
	return len(peerMap)
}

// getLatestBlockHeights gets the latest block height for each network
func (s *StatsService) getLatestBlockHeights() map[string]uint32 {
	heights := make(map[string]uint32)
	
	var blocks []model.Block
	if err := s.db.Table("blocks").
		Select("network, MAX(height) as height").
		Group("network").
		Find(&blocks).Error; err == nil {
		for _, block := range blocks {
			if block.Network != "" {
				heights[block.Network] = block.Height
			}
		}
	}
	
	return heights
}

// getTopPeers gets the most active peers
func (s *StatsService) getTopPeers() []PeerSummary {
	var topPeers []PeerSummary
	
	// Complex query to get peer activity across all tables
	query := `
		WITH peer_activity AS (
			SELECT peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen
			FROM blocks
			WHERE peer_id != ''
			GROUP BY peer_id
			
			UNION ALL
			
			SELECT peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen
			FROM mining_ons
			WHERE peer_id != ''
			GROUP BY peer_id
			
			UNION ALL
			
			SELECT peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen
			FROM subtrees
			WHERE peer_id != ''
			GROUP BY peer_id
			
			UNION ALL
			
			SELECT peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen
			FROM handshakes
			WHERE peer_id != ''
			GROUP BY peer_id
			
			UNION ALL
			
			SELECT peer_id, COUNT(*) as message_count, MAX(received_at) as last_seen
			FROM rejected_txes
			WHERE peer_id != ''
			GROUP BY peer_id
		)
		SELECT 
			peer_id,
			SUM(message_count) as total_messages,
			MAX(last_seen) as last_seen
		FROM peer_activity
		GROUP BY peer_id
		ORDER BY total_messages DESC
		LIMIT 10
	`
	
	type PeerActivity struct {
		PeerID        string
		TotalMessages int64
		LastSeen      string  // SQLite returns string for datetime
	}
	
	var peerActivities []PeerActivity
	if err := s.db.Raw(query).Scan(&peerActivities).Error; err == nil {
		for _, pa := range peerActivities {
			// Parse the timestamp string
			var lastSeenTime time.Time
			timeFormats := []string{
				"2006-01-02 15:04:05",
				"2006-01-02T15:04:05Z",
				"2006-01-02T15:04:05",
				time.RFC3339,
			}
			for _, format := range timeFormats {
				if t, err := time.Parse(format, pa.LastSeen); err == nil {
					lastSeenTime = t
					break
				}
			}
			
			topPeers = append(topPeers, PeerSummary{
				PeerID:       pa.PeerID,
				MessageCount: pa.TotalMessages,
				LastSeen:     lastSeenTime.Format(time.RFC3339),
			})
		}
	} else {
		s.log.Warnf("Failed to get top peers: %v", err)
	}
	
	return topPeers
}

// getLastMessageTime gets the most recent message time across all tables
func (s *StatsService) getLastMessageTime() time.Time {
	var lastTime time.Time
	tables := []string{"blocks", "mining_ons", "subtrees", "handshakes", "rejected_txes", "best_block_requests"}

	for _, table := range tables {
		var tableTime *time.Time
		row := s.db.Table(table).Select("MAX(received_at) as received_at").Row()
		if row != nil {
			if err := row.Scan(&tableTime); err == nil && tableTime != nil {
				if tableTime.After(lastTime) {
					lastTime = *tableTime
				}
			}
		}
	}

	return lastTime
}

// GetCachedStats retrieves the latest cached statistics
func (s *StatsService) GetCachedStats() (*model.StatsCache, error) {
	var stats model.StatsCache
	if err := s.db.Order("calculated_at DESC").First(&stats).Error; err != nil {
		return nil, err
	}
	return &stats, nil
}