//go:build postgres
// +build postgres

package main

import (
	"context"
	"fmt"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/http"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/parser"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/service"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	"github.com/sirupsen/logrus"
	"strings"
	"time"

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
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=UTC",
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
	sqlDB.SetMaxOpenConns(50)        // PostgreSQL can handle many connections
	sqlDB.SetMaxIdleConns(25)        // Keep connections ready
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("failed to ping PostgreSQL database: %v", err)
	}

	log.Info("Successfully connected to PostgreSQL database")

	// Initialize batch insert service
	batchService := service.NewBatchInsertService(db, log, 1000, 5*time.Second)
	defer batchService.Stop()

	// Load P2P settings from config
	bootstrapAddresses := viper.GetStringSlice("p2p.bootstrap_addresses")
	sharedKey := viper.GetString("p2p.shared_key")
	dhtProtocolID := viper.GetString("p2p.dht_protocol_id")
	port := viper.GetInt("p2p.port")
	listenAddresses := viper.GetStringSlice("p2p.listen_addresses")
	advertise := viper.GetBool("p2p.advertise")
	usePrivateDHT := viper.GetBool("p2p.use_private_dht")

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
		log.Infof("Generated %d topics from %d networks", len(topics), len(networks))
	}

	config := p2p.Config{
		ProcessName:        "teranode-p2p-poc",
		Port:               port,
		ListenAddresses:    listenAddresses,
		Advertise:          advertise,
		UsePrivateDHT:      usePrivateDHT,
		SharedKey:          sharedKey,
		BootstrapAddresses: bootstrapAddresses,
		DHTProtocolID:      dhtProtocolID,
	}

	node, err := p2p.NewNode(ctx, log, config)
	if err != nil {
		panic(err)
	}
	err = node.Start(ctx, nil, topics...)
	if err != nil {
		panic(err)
	}

	// Set up message handlers with batch processing
	for _, topic := range topics {
		topicCopy := topic // capture range variable
		err = node.SetTopicHandler(ctx, topicCopy, func(ctx context.Context, data []byte, peer string) {
			// Try to parse the message
			parsedMsg, parseErr := parser.ParseMessage(topicCopy, data)

			if parseErr != nil {
				log.Warnf("Failed to parse message for topic %s: %v", topicCopy, parseErr)
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

			case parser.TypeRejectedTx:
				rejectedMsg := parsedMsg.Data.(p2p.RejectedTxMessage)
				if err := batchService.AddRejectedTx(model.RejectedTxPG{
					Network:    parsedMsg.Network,
					TxID:       rejectedMsg.TxID,
					Reason:     rejectedMsg.Reason,
					PeerID:     rejectedMsg.PeerID,
					ReceivedAt: receivedAt,
				}); err != nil {
					log.Errorf("Failed to add rejected tx to batch: %v", err)
				}
			}

			// Broadcast to WebSocket clients (lightweight operation)
			websocket.BroadcastMessage(model.Message{
				Topic:      topicCopy,
				Data:       string(data),
				Peer:       peer,
				ReceivedAt: receivedAt,
			})
		})
		if err != nil {
			panic(err)
		}
	}

	// Initialize stats service with PostgreSQL optimizations
	statsService := service.NewStatsServicePostgres(db, log)

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

	// Refresh materialized views periodically (every 5 minutes)
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				log.Info("Refreshing materialized views...")
				if err := db.Exec("SELECT refresh_all_materialized_views()").Error; err != nil {
					log.Errorf("Failed to refresh materialized views: %v", err)
				} else {
					log.Info("Materialized views refreshed successfully")
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
				log.Infof("Connected peers: %d", len(node.ConnectedPeers()))
			}
		}
	}()

	// Create monthly partitions proactively
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		// Run once on startup
		if err := db.Exec("SELECT create_monthly_partitions()").Error; err != nil {
			log.Errorf("Failed to create monthly partitions: %v", err)
		}

		for {
			select {
			case <-ticker.C:
				if err := db.Exec("SELECT create_monthly_partitions()").Error; err != nil {
					log.Errorf("Failed to create monthly partitions: %v", err)
				}
			}
		}
	}()

	select {}
}