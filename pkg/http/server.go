package http

import (
	"encoding/json"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	tWebsocket "github.com/bsv-blockchain/teranode-p2p-poc/pkg/websocket"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"net/http"
	"strconv"
)

func InitServer(log *logrus.Logger, db *gorm.DB) {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./frontend/index.html")
			return
		}
		if len(r.URL.Path) > 10 && r.URL.Path[:10] == "/frontend/" {
			fs := http.StripPrefix("/frontend/", http.FileServer(http.Dir("./frontend")))
			fs.ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("404 not found"))
	})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
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

	http.HandleFunc("/messages", func(w http.ResponseWriter, r *http.Request) {
		topic := r.URL.Query().Get("topic")
		peer := r.URL.Query().Get("peer")
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

		var messages []model.Message
		query := db.Order("received_at asc").Limit(limit).Offset(offset)
		if topic != "" {
			query = query.Where("topic = ?", topic)
		}
		if peer != "" {
			query = query.Where("peer = ?", peer)
		}
		if err := query.Find(&messages).Error; err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("Database error: " + err.Error()))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(messages)
	})
	addr := ":8080"
	log.Infof("HTTP message query server listening on %s", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Errorf("HTTP server error: %v", err)
	}
}
