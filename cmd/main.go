package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/http"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/parser"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/service"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	simonp2p "github.com/bsv-blockchain/go-p2p-message-bus"
	"github.com/sirupsen/logrus"

	"github.com/bsv-blockchain/go-p2p"
	"github.com/spf13/viper"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	ctx := context.Background()
	log := logrus.New()
	log.SetLevel(logrus.InfoLevel)

	// Initialize Viper
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.SetEnvPrefix("teranode_p2p")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	viper.AutomaticEnv()
	if err := viper.ReadInConfig(); err != nil {
		panic(fmt.Errorf("fatal error reading config file: %w", err))
	}

	// Load PostgreSQL configuration
	dbHost := viper.GetString("database.host")
	dbPort := viper.GetInt("database.port")
	dbUser := viper.GetString("database.user")
	dbPassword := viper.GetString("database.password")
	dbName := viper.GetString("database.name")
	dbSSLMode := viper.GetString("database.sslmode")

	if dbHost == "" {
		dbHost = "localhost"
	}
	if dbPort == 0 {
		dbPort = 5432
	}
	if dbSSLMode == "" {
		dbSSLMode = "disable"
	}

	// Build PostgreSQL connection string
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC statement_timeout=30000 lock_timeout=5000",
		dbHost, dbPort, dbUser, dbPassword, dbName, dbSSLMode)

	// Connect to PostgreSQL with optimized settings
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: false, // Enable prepared statement cache
	}), &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		PrepareStmt:            true, // Use prepared statements
		SkipDefaultTransaction: true, // Skip default transaction for better performance
	})

	if err != nil {
		log.Fatalf("failed to connect to PostgreSQL database: %v", err)
	}

	// Configure connection pool for PostgreSQL
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get underlying SQL database: %v", err)
	}

	// Optimized connection pool settings for PostgreSQL
	sqlDB.SetMaxOpenConns(50) // PostgreSQL can handle many connections
	sqlDB.SetMaxIdleConns(25) // Keep connections ready
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("failed to ping PostgreSQL database: %v", err)
	}

	log.Info("Successfully connected to PostgreSQL database")

	// Check if tables exist and run GORM auto-migration if needed
	log.Info("Checking database schema...")

	// First, ensure the node_statuses table exists (as it's partitioned, we need to create it manually)
	nodeStatusTableSQL := `
	CREATE TABLE IF NOT EXISTS node_statuses (
		id BIGSERIAL,
		network VARCHAR(20) NOT NULL,
		type VARCHAR(20) NOT NULL,
		base_url TEXT,
		peer_id VARCHAR(100) NOT NULL,
		version VARCHAR(50),
		commit_hash VARCHAR(64),
		best_block_hash VARCHAR(64) NOT NULL,
		best_height INTEGER NOT NULL,
		block_assembly_details JSONB,
		fsm_state VARCHAR(50),
		start_time BIGINT NOT NULL,
		uptime DOUBLE PRECISION NOT NULL,
		client_name VARCHAR(100),
		miner_name VARCHAR(100),
		listen_mode VARCHAR(50),
		chain_work TEXT,
		sync_peer_id VARCHAR(100),
		sync_peer_height INTEGER DEFAULT 0,
		sync_peer_block_hash VARCHAR(64),
		sync_connected_at BIGINT DEFAULT 0,
		received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		PRIMARY KEY (id, received_at)
	) PARTITION BY RANGE (received_at);`

	if err := db.Exec(nodeStatusTableSQL).Error; err != nil {
		if !strings.Contains(err.Error(), "already exists") {
			log.Warnf("Failed to create node_statuses table: %v", err)
		}
	}

	// Use GORM auto-migration for PostgreSQL models
	if err := db.AutoMigrate(
		&model.BlockPG{},
		&model.BlockHeaderPG{},
		&model.HandshakePG{},
		&model.MiningOnPG{},
		&model.SubtreePG{},
		&model.BestBlockRequestPG{},
		&model.StatsCachePG{},
		&model.NodeStatusPG{},
	); err != nil {
		log.Warnf("AutoMigrate warning: %v", err)
	} else {
		log.Info("Database schema check completed")
	}

	if err := model.EnsureRetentionObjects(db, log); err != nil {
		log.Errorf("Failed to ensure retention objects: %v — retention is impaired, disk usage may grow unbounded", err)
	}

	if err := model.EnsureAutovacuumSettings(db, log); err != nil {
		log.Warnf("Failed to ensure autovacuum settings: %v", err)
	}

	// Create partitions for current and next months if they don't exist.
	// node_statuses is always partitioned by this app (created PARTITION BY RANGE above), so it
	// is handled explicitly here. The other message tables' shape varies by deployment (plain in
	// PROD via AutoMigrate, partitioned via migrations/001 / local docker) and is handled by the
	// synchronous create_monthly_partitions() call below plus runtime relkind detection in
	// pkg/model/retention.go — not by this loop.
	log.Info("Creating database partitions for current month...")
	currentTime := time.Now()
	partitionTables := []string{"node_statuses"}

	for _, tableName := range partitionTables {
		// Create partition for current month
		currentMonth := currentTime.Format("2006_01")
		partitionName := fmt.Sprintf("%s_%s", tableName, currentMonth)
		startDate := time.Date(currentTime.Year(), currentTime.Month(), 1, 0, 0, 0, 0, time.UTC)
		endDate := startDate.AddDate(0, 1, 0)

		createPartitionSQL := fmt.Sprintf(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '%s') THEN
					CREATE TABLE %s PARTITION OF %s
					FOR VALUES FROM ('%s') TO ('%s');
				END IF;
			END $$;
		`, partitionName, partitionName, tableName,
			startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

		if err := db.Exec(createPartitionSQL).Error; err != nil {
			log.Warnf("Failed to create partition %s: %v", partitionName, err)
		} else {
			log.Infof("Ensured partition %s exists", partitionName)
		}

		// Also create partition for next month
		nextMonth := currentTime.AddDate(0, 1, 0)
		nextMonthStr := nextMonth.Format("2006_01")
		nextPartitionName := fmt.Sprintf("%s_%s", tableName, nextMonthStr)
		nextStartDate := time.Date(nextMonth.Year(), nextMonth.Month(), 1, 0, 0, 0, 0, time.UTC)
		nextEndDate := nextStartDate.AddDate(0, 1, 0)

		createNextPartitionSQL := fmt.Sprintf(`
			DO $$
			BEGIN
				IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = '%s') THEN
					CREATE TABLE %s PARTITION OF %s
					FOR VALUES FROM ('%s') TO ('%s');
				END IF;
			END $$;
		`, nextPartitionName, nextPartitionName, tableName,
			nextStartDate.Format("2006-01-02"), nextEndDate.Format("2006-01-02"))

		if err := db.Exec(createNextPartitionSQL).Error; err != nil {
			log.Warnf("Failed to create next partition %s: %v", nextPartitionName, err)
		}
	}

	// Synchronously ensure current+next month partitions exist for EVERY partitioned table
	// (relkind='p'), whatever this deployment's schema shape turns out to be — PROD has the
	// message tables plain and only node_statuses partitioned, but migrations/001 and local
	// docker have all of them partitioned. This must complete before the P2P client
	// subscribes/starts accepting writes below, closing the startup race where an insert into
	// a partitioned table could fail with "no partition found for row" if the async 24h
	// retention goroutine hasn't run yet. create_monthly_partitions() is fast (metadata-only).
	log.Info("Ensuring monthly partitions exist for all partitioned tables...")
	if err := db.Exec("SELECT create_monthly_partitions()").Error; err != nil {
		log.Errorf("Failed to create monthly partitions: %v", err)
	}

	retentionMonths := viper.GetInt("performance.partition_retention_months")
	if retentionMonths < 1 {
		retentionMonths = 3
	}
	log.Infof("Data retention: keeping %d month(s)", retentionMonths)

	// Initialize batch insert service
	batchService := service.NewBatchInsertService(db, log, 1000, 5*time.Second)
	defer batchService.Stop()

	// Load P2P settings from config
	port := viper.GetInt("p2p.port")
	bootstrapPeers := viper.GetStringSlice("p2p.bootstrap_peers")
	dhtMode := viper.GetString("p2p.dht_mode")
	if dhtMode == "" {
		dhtMode = "off"
	}
	announceAddrs := viper.GetStringSlice("p2p.announce_addrs")
	peerCacheFile := viper.GetString("p2p.peer_cache_file")
	maxConn := viper.GetInt("p2p.max_connections")
	minConn := viper.GetInt("p2p.min_connections")

	if len(bootstrapPeers) == 0 {
		log.Fatal("p2p.bootstrap_peers is required")
	}

	// Get networks from config and generate topics
	var topics []string
	networks := viper.GetStringSlice("networks")
	if len(networks) == 0 {
		// Fallback to old topics config if networks not specified
		topics = viper.GetStringSlice("topics")
		if len(topics) == 0 {
			log.Fatalf("neither 'networks' nor 'topics' configured")
		}
		log.Warn("Using deprecated 'topics' config. Please migrate to 'networks' config.")
	} else {
		topics = parser.GenerateTopics(networks)
		// Add the node_status topic which doesn't have network prefix
		topics = append(topics, "bitcoin/node_status")
		log.Infof("Generated %d topics from %d networks", len(topics), len(networks))
	}

	pk, err := simonp2p.GeneratePrivateKey()
	if err != nil {
		panic(err)
	}

	newConfig := simonp2p.Config{
		Name:           "teranode-p2p-listener",
		Port:           port,
		Logger:         log,
		PrivateKey:     pk,
		BootstrapPeers: bootstrapPeers,
		DHTMode:        dhtMode,
		AnnounceAddrs:  announceAddrs,
		PeerCacheFile:  peerCacheFile,
		MaxConnections: maxConn,
		MinConnections: minConn,
	}

	node, err := simonp2p.NewClient(newConfig)
	if err != nil {
		panic(err)
	}

	for _, topic := range topics {
		log.Infof("Subscribing to topic: %s", topic)
		topicChannel := node.Subscribe(topic)
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				case msg, ok := <-topicChannel:
					if !ok {
						log.Warnf("Topic channel closed for topic: %s", topic)
						return
					}
					data := msg.Data
					// Handle incoming messages if needed
					log.Infof("Received message on topic %s from peer %s", msg.Topic, msg.FromID)
					// Try to parse the message
					parsedMsg, parseErr := parser.ParseMessage(topic, data)

					if parseErr != nil {
						log.Warnf("Failed to parse message for topic %s: %v", topic, parseErr)
						return
					}

					// Capture timestamp once for consistent storage
					receivedAt := time.Now()

					// Store parsed message using batch insert service
					switch parsedMsg.Type {
					case parser.TypeBestBlock:
						bbMsg := parsedMsg.Data.(p2p.BestBlockRequestMessage)
						if err := batchService.AddBestBlockRequest(model.BestBlockRequestPG{
							Network:    parsedMsg.Network,
							PeerID:     bbMsg.PeerID,
							ReceivedAt: receivedAt,
						}); err != nil {
							log.Errorf("Failed to add best block request to batch: %v", err)
						}

					case parser.TypeBlock:
						blockMsg := parsedMsg.Data.(p2p.BlockMessage)
						block := model.BlockPG{
							Network:    parsedMsg.Network,
							Hash:       blockMsg.Hash,
							Height:     blockMsg.Height,
							DataHubURL: blockMsg.DataHubURL,
							PeerID:     blockMsg.PeerID,
							Header:     blockMsg.Header,
							ReceivedAt: receivedAt,
						}

						if err := batchService.AddBlock(block); err != nil {
							log.Errorf("Failed to add block to batch: %v", err)
						}

						// Parse and store block header if available
						if blockMsg.Header != "" {
							blockHeader, parseErr := parser.ParseBlockHeader(blockMsg.Header, parsedMsg.Network, receivedAt)
							if parseErr != nil {
								log.Errorf("Failed to parse block header: %v", parseErr)
							} else {
								// Convert to PostgreSQL model
								headerPG := model.BlockHeaderPG{
									Network:        blockHeader.Network,
									Hash:           blockMsg.Hash,
									Height:         blockMsg.Height,
									Version:        blockHeader.Version,
									PreviousHash:   blockHeader.PreviousHash,
									MerkleRoot:     blockHeader.MerkleRoot,
									Timestamp:      blockHeader.Timestamp,
									Bits:           blockHeader.Bits,
									Nonce:          uint64(blockHeader.Nonce),
									ReceivedAt:     receivedAt,
									CoinbaseValue:  blockHeader.CoinbaseValue,
									CoinbaseScript: blockHeader.CoinbaseScript,
									MinerAddress:   blockHeader.MinerAddress,
									CoinbaseTxID:   blockHeader.CoinbaseTxID,
									CoinbaseText:   blockHeader.CoinbaseText,
								}

								if err := batchService.AddBlockHeader(headerPG); err != nil {
									log.Errorf("Failed to add block header to batch: %v", err)
								}
							}
						}

					case parser.TypeMiningOn:
						miningMsg := parsedMsg.Data.(p2p.MiningOnMessage)
						if err := batchService.AddMiningOn(model.MiningOnPG{
							Network:      parsedMsg.Network,
							Hash:         miningMsg.Hash,
							PreviousHash: miningMsg.PreviousHash,
							DataHubURL:   miningMsg.DataHubURL,
							PeerID:       miningMsg.PeerID,
							Height:       miningMsg.Height,
							Miner:        miningMsg.Miner,
							SizeInBytes:  miningMsg.SizeInBytes,
							TxCount:      miningMsg.TxCount,
							ReceivedAt:   receivedAt,
						}); err != nil {
							log.Errorf("Failed to add mining message to batch: %v", err)
						}

					case parser.TypeSubtree:
						subtreeMsg := parsedMsg.Data.(p2p.SubtreeMessage)
						if err := batchService.AddSubtree(model.SubtreePG{
							Network:    parsedMsg.Network,
							Hash:       subtreeMsg.Hash,
							DataHubURL: subtreeMsg.DataHubURL,
							PeerID:     subtreeMsg.PeerID,
							ReceivedAt: receivedAt,
						}); err != nil {
							log.Errorf("Failed to add subtree to batch: %v", err)
						}

					case parser.TypeHandshake:
						handshakeMsg := parsedMsg.Data.(p2p.HandshakeMessage)
						if err := batchService.AddHandshake(model.HandshakePG{
							Network:    parsedMsg.Network,
							Type:       string(handshakeMsg.Type),
							PeerID:     handshakeMsg.PeerID,
							BestHeight: handshakeMsg.BestHeight,
							BestHash:   handshakeMsg.BestHash,
							DataHubURL: handshakeMsg.DataHubURL,
							UserAgent:  handshakeMsg.UserAgent,
							Services:   uint64(handshakeMsg.Services),
							ReceivedAt: receivedAt,
						}); err != nil {
							log.Errorf("Failed to add handshake to batch: %v", err)
						}

					case parser.TypeNodeStatus:
						nodeStatusMsg := parsedMsg.Data.(parser.NodeStatusMessage)

						// Convert block assembly details to JSON if present
						var blockAssemblyJSON string
						if nodeStatusMsg.BlockAssemblyDetails != nil {
							if jsonBytes, err := json.Marshal(nodeStatusMsg.BlockAssemblyDetails); err == nil {
								blockAssemblyJSON = string(jsonBytes)
							} else {
								// If marshaling fails, use empty JSON object
								blockAssemblyJSON = "{}"
							}
						} else {
							// Use empty JSON object instead of empty string for NULL values
							blockAssemblyJSON = "{}"
						}

						if err := batchService.AddNodeStatus(model.NodeStatusPG{
							Network:              parsedMsg.Network,
							Type:                 nodeStatusMsg.Type,
							BaseURL:              nodeStatusMsg.BaseURL,
							PeerID:               nodeStatusMsg.PeerID,
							Version:              nodeStatusMsg.Version,
							CommitHash:           nodeStatusMsg.CommitHash,
							BestBlockHash:        nodeStatusMsg.BestBlockHash,
							BestHeight:           nodeStatusMsg.BestHeight,
							BlockAssemblyDetails: blockAssemblyJSON,
							FSMState:             nodeStatusMsg.FSMState,
							StartTime:            nodeStatusMsg.StartTime,
							Uptime:               nodeStatusMsg.Uptime,
							ClientName:           nodeStatusMsg.ClientName,
							MinerName:            nodeStatusMsg.MinerName,
							ListenMode:           nodeStatusMsg.ListenMode,
							ChainWork:            nodeStatusMsg.ChainWork,
							SyncPeerID:           nodeStatusMsg.SyncPeerID,
							SyncPeerHeight:       nodeStatusMsg.SyncPeerHeight,
							SyncPeerBlockHash:    nodeStatusMsg.SyncPeerBlockHash,
							SyncConnectedAt:      nodeStatusMsg.SyncConnectedAt,
							ReceivedAt:           receivedAt,
						}); err != nil {
							log.Errorf("Failed to add node status to batch: %v", err)
						}
					}

					// Broadcast to WebSocket clients (lightweight operation)
					websocket.BroadcastMessage(model.Message{
						Topic:      topic,
						Data:       string(data),
						Peer:       msg.FromID,
						ReceivedAt: receivedAt,
					})
				}
			}
		}()
	}

	// Initialize stats service with PostgreSQL optimizations
	statsService := service.NewStatsService(db, log)

	// Start HTTP server for querying messages
	go http.InitServer(log, db, statsService)

	// Calculate stats once on startup
	go func() {
		// Small delay to let some messages accumulate
		time.Sleep(10 * time.Second)
		if err := statsService.CalculateStats(); err != nil {
			log.Errorf("Failed to calculate initial stats: %v", err)
		}
	}()

	// Start background stats calculation (every minute)
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := statsService.CalculateStats(); err != nil {
					log.Errorf("Failed to calculate stats: %v", err)
				}
			}
		}
	}()

	// Monitor connected peers
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				log.Infof("Connected peers: %d", len(node.GetPeers()))
			}
		}
	}()

	// Run retention (create partitions, drop old partitions, delete old rows) daily
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Run once on startup — reclaims the existing backlog immediately.
		model.RunRetention(db, log, retentionMonths)

		for {
			select {
			case <-ticker.C:
				model.RunRetention(db, log, retentionMonths)
			}
		}
	}()

	select {}
}
