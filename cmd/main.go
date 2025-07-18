package main

import (
	"context"
	"fmt"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/http"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	"github.com/sirupsen/logrus"
	"strings"
	"time"

	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/p2p"
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
	db, err := gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	// Auto-migrate Message schema
	err = db.AutoMigrate(&model.Message{})
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
	topics := viper.GetStringSlice("topics")

	config := p2p.P2PConfig{
		ProcessName:        "teranode-p2p",
		Port:               port,
		ListenAddresses:    listenAddresses,
		Advertise:          advertise,
		UsePrivateDHT:      usePrivateDHT,
		SharedKey:          sharedKey,
		BootstrapAddresses: bootstrapAddresses,
		DHTProtocolID:      dhtProtocolID,
	}

	node, err := p2p.NewP2PNode(ctx, log, config)
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
			msg := model.Message{
				Topic:      topicCopy,
				Data:       string(data),
				Peer:       peer,
				ReceivedAt: time.Now(),
			}
			if err := db.Create(&msg).Error; err != nil {
				log.Errorf("Failed to store message for topic %s: %v", topicCopy, err)
			} else {
				log.Infof("Stored message for topic %s from %s", topicCopy, peer)
				websocket.BroadcastMessage(msg)
			}
		})
		if err != nil {
			panic(err)
		}
	}

	// Start HTTP server for querying messages
	go http.InitServer(log, db)

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
