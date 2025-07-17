package main

import (
	"github.com/gorilla/websocket"
	"sync"
)

// Websocket client manager
var wsClients = struct {
	conns map[*websocket.Conn]bool
	mu    sync.Mutex
}{conns: make(map[*websocket.Conn]bool)}

func broadcastMessage(msg Message) {
	wsClients.mu.Lock()
	defer wsClients.mu.Unlock()
	for conn := range wsClients.conns {
		if err := conn.WriteJSON(msg); err != nil {
			conn.Close()
			delete(wsClients.conns, conn)
		}
	}
}
