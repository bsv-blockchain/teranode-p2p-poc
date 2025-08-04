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

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	ctx := context.Background()
	log := logrus.New()

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

	// Load DB path from config
	databasePath := viper.GetString("database.path")
	if databasePath == "" {
		log.Fatalf("database.path not set in config file")
	}

	// Initialize SQLite DB with GORM
	// Enable WAL mode and optimize for concurrent reads
	dsn := fmt.Sprintf("%s?_journal_mode=WAL&_busy_timeout=5000&_synchronous=NORMAL&cache=shared", databasePath)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database [%s]: %v", databasePath, err)
	}
	
	// Configure connection pool for SQLite
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get underlying SQL database: %v", err)
	}
	
	// Set max open connections to 1 for SQLite (prevents database locked errors)
	// WAL mode allows multiple readers even with single writer
	sqlDB.SetMaxOpenConns(1)
	// Set max idle connections
	sqlDB.SetMaxIdleConns(1)
	// Set max lifetime of a connection
	sqlDB.SetConnMaxLifetime(time.Hour)
	// Auto-migrate all schemas
	err = model.MigrateAll(db)
	if err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

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
	for _, topic := range topics {
		topicCopy := topic // capture range variable
		err = node.SetTopicHandler(ctx, topicCopy, func(ctx context.Context, data []byte, peer string) {
			// Try to parse the message
			parsedMsg, parseErr := parser.ParseMessage(topicCopy, data)

			if parseErr != nil {
				// If parsing fails, store as generic message
				log.Warnf("Failed to parse message for topic %s: %v", topicCopy, parseErr)
				msg := model.Message{
					Topic:      topicCopy,
					Data:       string(data),
					Peer:       peer,
					ReceivedAt: time.Now(),
				}
				if err := db.Create(&msg).Error; err != nil {
					log.Errorf("Failed to store generic message for topic %s: %v", topicCopy, err)
				} else {
					websocket.BroadcastMessage(msg)
				}
				return
			}

			// Capture timestamp once for consistent storage
			receivedAt := time.Now()

			// Store parsed message in appropriate table
			var storeErr error
			switch parsedMsg.Type {
			case parser.TypeBestBlock:
				bbMsg := parsedMsg.Data.(p2p.BestBlockRequestMessage)
				storeErr = db.Create(&model.BestBlockRequest{
					Network:    parsedMsg.Network,
					PeerID:     bbMsg.PeerID,
					ReceivedAt: receivedAt,
				}).Error

			case parser.TypeBlock:
				blockMsg := parsedMsg.Data.(p2p.BlockMessage)
				storeErr = db.Create(&model.Block{
					Network:    parsedMsg.Network,
					Hash:       blockMsg.Hash,
					Height:     blockMsg.Height,
					DataHubURL: blockMsg.DataHubURL,
					PeerID:     blockMsg.PeerID,
					Header:     blockMsg.Header,
					ReceivedAt: receivedAt,
				}).Error

				// Parse and store block header if available
				if storeErr == nil && blockMsg.Header != "" {
					blockHeader, parseErr := parser.ParseBlockHeader(blockMsg.Header, parsedMsg.Network, receivedAt)
					if parseErr != nil {
						log.Errorf("Failed to parse block header: %v", parseErr)
					} else {
						// Update height from the block message
						blockHeader.Height = blockMsg.Height
						blockHeader.Hash = blockMsg.Hash

						if err := db.Create(blockHeader).Error; err != nil {
							log.Errorf("Failed to store block header: %v", err)
						} else {
							log.Infof("Stored block header for block %s at height %d", blockMsg.Hash, blockMsg.Height)
						}
					}
				}

			case parser.TypeMiningOn:
				miningMsg := parsedMsg.Data.(p2p.MiningOnMessage)
				storeErr = db.Create(&model.MiningOn{
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
				}).Error

			case parser.TypeSubtree:
				subtreeMsg := parsedMsg.Data.(p2p.SubtreeMessage)
				storeErr = db.Create(&model.Subtree{
					Network:    parsedMsg.Network,
					Hash:       subtreeMsg.Hash,
					DataHubURL: subtreeMsg.DataHubURL,
					PeerID:     subtreeMsg.PeerID,
					ReceivedAt: receivedAt,
				}).Error

			case parser.TypeHandshake:
				handshakeMsg := parsedMsg.Data.(p2p.HandshakeMessage)
				storeErr = db.Create(&model.Handshake{
					Network:    parsedMsg.Network,
					Type:       string(handshakeMsg.Type),
					PeerID:     handshakeMsg.PeerID,
					BestHeight: handshakeMsg.BestHeight,
					BestHash:   handshakeMsg.BestHash,
					DataHubURL: handshakeMsg.DataHubURL,
					UserAgent:  handshakeMsg.UserAgent,
					Services:   handshakeMsg.Services,
					ReceivedAt: receivedAt,
				}).Error

			case parser.TypeRejectedTx:
				rejectedMsg := parsedMsg.Data.(p2p.RejectedTxMessage)
				storeErr = db.Create(&model.RejectedTx{
					Network:    parsedMsg.Network,
					TxID:       rejectedMsg.TxID,
					Reason:     rejectedMsg.Reason,
					PeerID:     rejectedMsg.PeerID,
					ReceivedAt: receivedAt,
				}).Error
			}

			if storeErr != nil {
				log.Errorf("Failed to store %s message for topic %s: %v", parsedMsg.Type, topicCopy, storeErr)
			} else {
				log.Infof("Stored %s message for topic %s from %s", parsedMsg.Type, topicCopy, peer)
				// Also store in generic message table for compatibility
				msg := model.Message{
					Topic:      topicCopy,
					Data:       string(data),
					Peer:       peer,
					ReceivedAt: receivedAt,
				}
				db.Create(&msg) // Ignore error for generic storage
				websocket.BroadcastMessage(msg)
			}
		})
		if err != nil {
			panic(err)
		}
	}

	// Start HTTP server for querying messages
	go http.InitServer(log, db)

	// Initialize coinbase service
	coinbaseService := service.NewCoinbaseService(db, log)
	
	// Start background processing of coinbase data
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		
		// Process once on startup
		coinbaseService.ProcessPendingBlocks()
		
		for {
			select {
			case <-ticker.C:
				coinbaseService.ProcessPendingBlocks()
			}
		}
	}()

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
	select {}
}

// GetMessagesByTopic returns all messages for a given topic
func GetMessagesByTopic(db *gorm.DB, topic string) ([]model.Message, error) {
	var messages []model.Message
	err := db.Where("topic = ?", topic).Order("received_at asc").Find(&messages).Error
	return messages, err
}
