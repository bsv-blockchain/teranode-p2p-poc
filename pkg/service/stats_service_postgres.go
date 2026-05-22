package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// StatsServicePostgres handles calculating and caching statistics for PostgreSQL
type StatsServicePostgres struct {
	db  *gorm.DB
	log *logrus.Logger
}

// NewStatsServicePostgres creates a new stats service for PostgreSQL
func NewStatsServicePostgres(db *gorm.DB, log *logrus.Logger) *StatsService {
	// For compatibility, we return the regular StatsService interface
	// but with PostgreSQL-optimized implementation
	return &StatsService{
		db:  db,
		log: log,
	}
}

// CalculateStats calculates all statistics using PostgreSQL optimizations
func (s *StatsService) CalculateStatsOptimized() error {
	startTime := time.Now()

	stats := &model.StatsCachePG{
		CalculatedAt: startTime,
	}

	// Use PostgreSQL aggregate functions for efficient counting
	// Count total messages across all tables in parallel
	type TableCount struct {
		TableName string
		Count     int64
	}

	// Efficient parallel counting using PostgreSQL
	query := `
		SELECT 'blocks' as table_name, COUNT(*) as count FROM blocks
		UNION ALL
		SELECT 'block_headers', COUNT(*) FROM block_headers
		UNION ALL
		SELECT 'handshakes', COUNT(*) FROM handshakes
		UNION ALL
		SELECT 'mining_ons', COUNT(*) FROM mining_ons
		UNION ALL
		SELECT 'subtrees', COUNT(*) FROM subtrees
		UNION ALL
		SELECT 'best_block_requests', COUNT(*) FROM best_block_requests
	`

	var tableCounts []TableCount
	if err := s.db.Raw(query).Scan(&tableCounts).Error; err != nil {
		return fmt.Errorf("failed to count messages: %w", err)
	}

	tableCountMap := make(map[string]int64)
	for _, tc := range tableCounts {
		tableCountMap[tc.TableName] = tc.Count
		stats.TotalMessages += tc.Count
	}

	if tableCountsJSON, err := json.Marshal(tableCountMap); err == nil {
		stats.MessageCountByTable = string(tableCountsJSON)
	}

	// Count messages from last 24 hours using PostgreSQL date functions
	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)

	var todayCount int64
	todayQuery := `
		SELECT SUM(count) FROM (
			SELECT COUNT(*) as count FROM blocks WHERE received_at > $1
			UNION ALL
			SELECT COUNT(*) FROM block_headers WHERE received_at > $1
			UNION ALL
			SELECT COUNT(*) FROM handshakes WHERE received_at > $1
			UNION ALL
			SELECT COUNT(*) FROM mining_ons WHERE received_at > $1
			UNION ALL
			SELECT COUNT(*) FROM subtrees WHERE received_at > $1
		) as daily_counts
	`
	if err := s.db.Raw(todayQuery, twentyFourHoursAgo).Scan(&todayCount).Error; err == nil {
		stats.MessagesToday = todayCount
	}

	// Get unique topics count (we know the topics from config, so this is deterministic)
	stats.UniqueTopics = 30 // 6 networks * 5 message types

	// Get unique peers using materialized view
	var uniquePeersCount int
	peerQuery := `
		SELECT COUNT(DISTINCT peer_id) FROM (
			SELECT DISTINCT peer_id FROM peer_activity_summary
		) as unique_peers
	`
	if err := s.db.Raw(peerQuery).Scan(&uniquePeersCount).Error; err == nil {
		stats.UniquePeers = uniquePeersCount
	}

	// Get latest block heights from materialized view
	latestHeights := make(map[string]uint32)
	type NetworkHeight struct {
		Network string
		Height  uint32
	}
	var networkHeights []NetworkHeight

	if err := s.db.Raw("SELECT network, height FROM latest_block_heights").Scan(&networkHeights).Error; err == nil {
		for _, nh := range networkHeights {
			latestHeights[nh.Network] = nh.Height
		}
	}

	if heightsJSON, err := json.Marshal(latestHeights); err == nil {
		stats.LatestBlockHeights = string(heightsJSON)
	}

	// Calculate topic statistics from materialized view
	topicStats := s.calculateTopicStatsOptimized()
	if topicStatsJSON, err := json.Marshal(topicStats); err == nil {
		stats.TopicStats = string(topicStatsJSON)
	}

	// Calculate network activity from materialized view
	networkActivity := s.calculateNetworkActivityOptimized()
	if networkActivityJSON, err := json.Marshal(networkActivity); err == nil {
		stats.NetworkActivity = string(networkActivityJSON)
	}

	// Get top peers efficiently
	topPeers := s.getTopPeersOptimized()
	if topPeersJSON, err := json.Marshal(topPeers); err == nil {
		stats.TopPeers = string(topPeersJSON)
	}

	// Get last message time
	var lastMessageTime time.Time
	lastTimeQuery := `
		SELECT MAX(last_activity) FROM (
			SELECT MAX(received_at) as last_activity FROM blocks
			UNION ALL
			SELECT MAX(received_at) FROM handshakes
			UNION ALL
			SELECT MAX(received_at) FROM mining_ons
			UNION ALL
			SELECT MAX(received_at) FROM subtrees
		) as last_times
	`
	if err := s.db.Raw(lastTimeQuery).Scan(&lastMessageTime).Error; err == nil && !lastMessageTime.IsZero() {
		stats.LastMessageTime = &lastMessageTime
	}

	// Calculate time taken
	stats.CalculationTimeMs = time.Since(startTime).Milliseconds()

	// Store in database (upsert - update if exists, insert if not)
	if err := s.db.Where("1 = 1").Delete(&model.StatsCachePG{}).Error; err != nil {
		return fmt.Errorf("failed to clear old stats: %w", err)
	}

	if err := s.db.Create(stats).Error; err != nil {
		return fmt.Errorf("failed to save stats: %w", err)
	}

	s.log.Infof("Statistics calculated in %dms using PostgreSQL optimizations", stats.CalculationTimeMs)
	return nil
}

// calculateTopicStatsOptimized uses PostgreSQL aggregation
func (s *StatsService) calculateTopicStatsOptimized() []TopicStat {
	var topicStats []TopicStat

	// Use PostgreSQL to aggregate topic statistics efficiently
	query := `
		WITH topic_counts AS (
			SELECT
				network || '-block' as topic_type,
				network,
				'block' as message_type,
				COUNT(*) as count
			FROM blocks
			GROUP BY network
			UNION ALL
			SELECT
				network || '-handshake' as topic_type,
				network,
				'handshake' as message_type,
				COUNT(*) as count
			FROM handshakes
			GROUP BY network
			UNION ALL
			SELECT
				network || '-miningon' as topic_type,
				network,
				'miningon' as message_type,
				COUNT(*) as count
			FROM mining_ons
			GROUP BY network
			UNION ALL
			SELECT
				network || '-subtree' as topic_type,
				network,
				'subtree' as message_type,
				COUNT(*) as count
			FROM subtrees
			GROUP BY network
		)
		SELECT
			'bitcoin/' || topic_type as topic,
			network,
			message_type,
			count
		FROM topic_counts
		ORDER BY count DESC
	`

	type TopicResult struct {
		Topic       string
		Network     string
		MessageType string
		Count       int64
	}

	var results []TopicResult
	if err := s.db.Raw(query).Scan(&results).Error; err == nil {
		for _, r := range results {
			topicStats = append(topicStats, TopicStat{
				Topic:        r.Topic,
				Network:      r.Network,
				MessageType:  r.MessageType,
				MessageCount: r.Count,
			})
		}
	}

	return topicStats
}

// calculateNetworkActivityOptimized uses materialized view
func (s *StatsService) calculateNetworkActivityOptimized() map[string]int64 {
	networkActivity := make(map[string]int64)

	query := `
		SELECT
			network,
			SUM(total_messages) as total
		FROM network_activity_summary
		GROUP BY network
	`

	type NetworkTotal struct {
		Network string
		Total   int64
	}

	var results []NetworkTotal
	if err := s.db.Raw(query).Scan(&results).Error; err == nil {
		for _, r := range results {
			networkActivity[r.Network] = r.Total
		}
	}

	return networkActivity
}

// getTopPeersOptimized uses PostgreSQL window functions
func (s *StatsService) getTopPeersOptimized() []PeerSummary {
	var topPeers []PeerSummary

	// Use window functions for efficient top peer calculation
	query := `
		WITH peer_totals AS (
			SELECT
				peer_id,
				SUM(message_count) as total_messages,
				MAX(last_seen) as last_seen
			FROM peer_activity_summary
			GROUP BY peer_id
		)
		SELECT
			peer_id,
			total_messages,
			last_seen
		FROM peer_totals
		ORDER BY total_messages DESC
		LIMIT 10
	`

	type PeerResult struct {
		PeerID        string
		TotalMessages int64
		LastSeen      time.Time
	}

	var results []PeerResult
	if err := s.db.Raw(query).Scan(&results).Error; err == nil {
		for _, r := range results {
			topPeers = append(topPeers, PeerSummary{
				PeerID:       r.PeerID,
				MessageCount: r.TotalMessages,
				LastSeen:     r.LastSeen.Format(time.RFC3339),
			})
		}
	}

	return topPeers
}

// GetCachedStatsOptimized retrieves the latest cached statistics
func (s *StatsService) GetCachedStatsOptimized() (*model.StatsCachePG, error) {
	var stats model.StatsCachePG
	if err := s.db.Order("calculated_at DESC").First(&stats).Error; err != nil {
		return nil, err
	}
	return &stats, nil
}