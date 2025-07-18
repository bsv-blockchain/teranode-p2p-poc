package websocket

import (
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/gorilla/websocket"
	"sync"
)

// Websocket client manager
var WsClients = struct {
	Conns map[*websocket.Conn]bool
	Mu    sync.Mutex
}{Conns: make(map[*websocket.Conn]bool)}

func BroadcastMessage(msg model.Message) {
	WsClients.Mu.Lock()
	defer WsClients.Mu.Unlock()
	for conn := range WsClients.Conns {
		if err := conn.WriteJSON(msg); err != nil {
			conn.Close()
			delete(WsClients.Conns, conn)
		}
	}
}
