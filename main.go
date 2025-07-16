package main

import (
	"context"
	"github.com/bitcoin-sv/teranode/services/p2p"
	"github.com/bitcoin-sv/teranode/settings"
	"github.com/bitcoin-sv/teranode/ulogger"
	"time"
)

func main() {
	ctx := context.Background()
	log := ulogger.New("teranode-p2p")
	nSettings := settings.NewSettings()
	nSettings.P2P = settings.P2PSettings{
		BootstrapAddresses: []string{
			"/dns4/teranode-bootstrap.bsvb.tech/tcp/9901/p2p/12D3KooWESmhNAN8s6NPdGNvJH3zJ4wMKDxapXKNUe2DzkAwKYqK",
		},
		SharedKey:     "285b49e6d910726a70f205086c39cbac6d8dcc47839053a21b1f614773bbc137",
		DHTProtocolID: "/teranode",
	}
	// Initialize the Teranode application
	config := p2p.P2PConfig{
		ProcessName:     "teranode-p2p",
		Port:            9901,
		ListenAddresses: []string{"127.0.0.1"},
		Advertise:       true,
		UsePrivateDHT:   true,
		SharedKey:       nSettings.P2P.SharedKey,
	}
	topics := []string{
		"bitcoin/mainnet-bestblock",
		"bitcoin/mainnet-block",
		"bitcoin/mainnet-subtree",
		"bitcoin/mainnet-mining_on",
		"bitcoin/mainnet-handshake",
		"bitcoin/mainnet-rejected_tx",
	}
	node, err := p2p.NewP2PNode(ctx, log, nSettings, config, nil)
	if err != nil {
		panic(err)
	}
	err = node.Start(ctx, nil, topics...)
	if err != nil {
		panic(err)
	}
	for _, topic := range topics {
		err = node.SetTopicHandler(ctx, topic, func(ctx context.Context, data []byte, from string) {
			log.Infof("Received %s data: %s", topic, data)
		})
		if err != nil {
			panic(err)
		}
	}
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
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
