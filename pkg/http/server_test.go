package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestHealthHandler(t *testing.T) {
	// healthHandler must return 200 when the DB pings OK.
	db := openHealthTestDB(t) // skips if no TEST DSN
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	healthHandler(db)(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body map[string]string
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["status"] != "ok" {
		t.Fatalf("expected status ok, got %v", body)
	}
}

func TestHealthHandlerDBDown(t *testing.T) {
	// A closed pool must yield 503.
	db := openHealthTestDB(t)
	sqlDB, _ := db.DB()
	sqlDB.Close()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)

	healthHandler(db)(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 on closed DB, got %d", rec.Code)
	}
}

func openHealthTestDB(t *testing.T) *gorm.DB { return healthTestDBImpl(t) }

// healthTestDBImpl connects to the DSN in TERANODE_P2P_TEST_DSN, or skips the test if unset.
// Start one with: docker-compose -f docker-compose.postgres.yml up -d
// then: TERANODE_P2P_TEST_DSN="host=localhost port=5432 user=teranode password=teranode dbname=teranode_p2p sslmode=disable TimeZone=UTC"
func healthTestDBImpl(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TERANODE_P2P_TEST_DSN")
	if dsn == "" {
		t.Skip("TERANODE_P2P_TEST_DSN not set; skipping DB integration test")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 logger.Default.LogMode(logger.Silent),
		SkipDefaultTransaction: true,
	})
	if err != nil {
		t.Fatalf("connect test db: %v", err)
	}
	return db
}
