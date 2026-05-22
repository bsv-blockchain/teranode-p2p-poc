package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// BatchInsertService handles efficient batch inserts to PostgreSQL
type BatchInsertService struct {
	db         *gorm.DB
	log        *logrus.Logger
	batchSize  int
	flushTimer time.Duration

	// Buffers for each message type
	blockBuffer       []model.BlockPG
	blockHeaderBuffer []model.BlockHeaderPG
	handshakeBuffer   []model.HandshakePG
	miningOnBuffer    []model.MiningOnPG
	subtreeBuffer     []model.SubtreePG
	bestBlockBuffer   []model.BestBlockRequestPG
	nodeStatusBuffer  []model.NodeStatusPG

	// Mutexes for thread-safe access
	blockMu       sync.Mutex
	blockHeaderMu sync.Mutex
	handshakeMu   sync.Mutex
	miningOnMu    sync.Mutex
	subtreeMu     sync.Mutex
	bestBlockMu   sync.Mutex
	nodeStatusMu  sync.Mutex

	// Context for shutdown
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// NewBatchInsertService creates a new batch insert service
func NewBatchInsertService(db *gorm.DB, log *logrus.Logger, batchSize int, flushInterval time.Duration) *BatchInsertService {
	ctx, cancel := context.WithCancel(context.Background())

	service := &BatchInsertService{
		db:                db,
		log:               log,
		batchSize:         batchSize,
		flushTimer:        flushInterval,
		ctx:               ctx,
		cancel:            cancel,
		blockBuffer:       make([]model.BlockPG, 0, batchSize),
		blockHeaderBuffer: make([]model.BlockHeaderPG, 0, batchSize),
		handshakeBuffer:   make([]model.HandshakePG, 0, batchSize),
		miningOnBuffer:    make([]model.MiningOnPG, 0, batchSize),
		subtreeBuffer:     make([]model.SubtreePG, 0, batchSize),
		bestBlockBuffer:   make([]model.BestBlockRequestPG, 0, batchSize),
		nodeStatusBuffer:  make([]model.NodeStatusPG, 0, batchSize),
	}

	// Start the periodic flush goroutine
	service.wg.Add(1)
	go service.periodicFlush()

	return service
}

// periodicFlush flushes all buffers periodically
func (s *BatchInsertService) periodicFlush() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.flushTimer)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			// Final flush before shutdown
			s.FlushAll()
			return
		case <-ticker.C:
			s.FlushAll()
		}
	}
}

// AddBlock adds a block to the buffer
func (s *BatchInsertService) AddBlock(block model.BlockPG) error {
	s.blockMu.Lock()
	defer s.blockMu.Unlock()

	s.blockBuffer = append(s.blockBuffer, block)

	if len(s.blockBuffer) >= s.batchSize {
		return s.flushBlocksLocked()
	}
	return nil
}

// AddBlockHeader adds a block header to the buffer
func (s *BatchInsertService) AddBlockHeader(header model.BlockHeaderPG) error {
	s.blockHeaderMu.Lock()
	defer s.blockHeaderMu.Unlock()

	s.blockHeaderBuffer = append(s.blockHeaderBuffer, header)

	if len(s.blockHeaderBuffer) >= s.batchSize {
		return s.flushBlockHeadersLocked()
	}
	return nil
}

// AddHandshake adds a handshake to the buffer
func (s *BatchInsertService) AddHandshake(handshake model.HandshakePG) error {
	s.handshakeMu.Lock()
	defer s.handshakeMu.Unlock()

	s.handshakeBuffer = append(s.handshakeBuffer, handshake)

	if len(s.handshakeBuffer) >= s.batchSize {
		return s.flushHandshakesLocked()
	}
	return nil
}

// AddMiningOn adds a mining_on message to the buffer
func (s *BatchInsertService) AddMiningOn(miningOn model.MiningOnPG) error {
	s.miningOnMu.Lock()
	defer s.miningOnMu.Unlock()

	s.miningOnBuffer = append(s.miningOnBuffer, miningOn)

	if len(s.miningOnBuffer) >= s.batchSize {
		return s.flushMiningOnsLocked()
	}
	return nil
}

// AddSubtree adds a subtree to the buffer
func (s *BatchInsertService) AddSubtree(subtree model.SubtreePG) error {
	s.subtreeMu.Lock()
	defer s.subtreeMu.Unlock()

	s.subtreeBuffer = append(s.subtreeBuffer, subtree)

	if len(s.subtreeBuffer) >= s.batchSize {
		return s.flushSubtreesLocked()
	}
	return nil
}

// AddBestBlockRequest adds a best block request to the buffer
func (s *BatchInsertService) AddBestBlockRequest(request model.BestBlockRequestPG) error {
	s.bestBlockMu.Lock()
	defer s.bestBlockMu.Unlock()

	s.bestBlockBuffer = append(s.bestBlockBuffer, request)

	if len(s.bestBlockBuffer) >= s.batchSize {
		return s.flushBestBlocksLocked()
	}
	return nil
}

// FlushAll flushes all buffers
func (s *BatchInsertService) FlushAll() {
	s.blockMu.Lock()
	if len(s.blockBuffer) > 0 {
		s.flushBlocksLocked()
	}
	s.blockMu.Unlock()

	s.blockHeaderMu.Lock()
	if len(s.blockHeaderBuffer) > 0 {
		s.flushBlockHeadersLocked()
	}
	s.blockHeaderMu.Unlock()

	s.handshakeMu.Lock()
	if len(s.handshakeBuffer) > 0 {
		s.flushHandshakesLocked()
	}
	s.handshakeMu.Unlock()

	s.miningOnMu.Lock()
	if len(s.miningOnBuffer) > 0 {
		s.flushMiningOnsLocked()
	}
	s.miningOnMu.Unlock()

	s.subtreeMu.Lock()
	if len(s.subtreeBuffer) > 0 {
		s.flushSubtreesLocked()
	}
	s.subtreeMu.Unlock()

	s.bestBlockMu.Lock()
	if len(s.bestBlockBuffer) > 0 {
		s.flushBestBlocksLocked()
	}
	s.bestBlockMu.Unlock()

	s.nodeStatusMu.Lock()
	if len(s.nodeStatusBuffer) > 0 {
		s.flushNodeStatusesLocked()
	}
	s.nodeStatusMu.Unlock()
}

// Internal flush methods (must be called with lock held)

func (s *BatchInsertService) flushBlocksLocked() error {
	if len(s.blockBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.blockBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert blocks: %v", err)
		return fmt.Errorf("batch insert blocks failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d blocks in %v", len(s.blockBuffer), time.Since(startTime))
	s.blockBuffer = s.blockBuffer[:0]
	return nil
}

func (s *BatchInsertService) flushBlockHeadersLocked() error {
	if len(s.blockHeaderBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.blockHeaderBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert block headers: %v", err)
		return fmt.Errorf("batch insert block headers failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d block headers in %v", len(s.blockHeaderBuffer), time.Since(startTime))
	s.blockHeaderBuffer = s.blockHeaderBuffer[:0]
	return nil
}

func (s *BatchInsertService) flushHandshakesLocked() error {
	if len(s.handshakeBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.handshakeBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert handshakes: %v", err)
		return fmt.Errorf("batch insert handshakes failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d handshakes in %v", len(s.handshakeBuffer), time.Since(startTime))
	s.handshakeBuffer = s.handshakeBuffer[:0]
	return nil
}

func (s *BatchInsertService) flushMiningOnsLocked() error {
	if len(s.miningOnBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.miningOnBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert mining_ons: %v", err)
		return fmt.Errorf("batch insert mining_ons failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d mining_ons in %v", len(s.miningOnBuffer), time.Since(startTime))
	s.miningOnBuffer = s.miningOnBuffer[:0]
	return nil
}

func (s *BatchInsertService) flushSubtreesLocked() error {
	if len(s.subtreeBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.subtreeBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert subtrees: %v", err)
		return fmt.Errorf("batch insert subtrees failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d subtrees in %v", len(s.subtreeBuffer), time.Since(startTime))
	s.subtreeBuffer = s.subtreeBuffer[:0]
	return nil
}

func (s *BatchInsertService) flushBestBlocksLocked() error {
	if len(s.bestBlockBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.bestBlockBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert best block requests: %v", err)
		return fmt.Errorf("batch insert best block requests failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d best block requests in %v", len(s.bestBlockBuffer), time.Since(startTime))
	s.bestBlockBuffer = s.bestBlockBuffer[:0]
	return nil
}

// AddNodeStatus adds a node status to the buffer
func (s *BatchInsertService) AddNodeStatus(nodeStatus model.NodeStatusPG) error {
	s.nodeStatusMu.Lock()
	defer s.nodeStatusMu.Unlock()

	s.nodeStatusBuffer = append(s.nodeStatusBuffer, nodeStatus)

	if len(s.nodeStatusBuffer) >= s.batchSize {
		return s.flushNodeStatusesLocked()
	}
	return nil
}

func (s *BatchInsertService) flushNodeStatusesLocked() error {
	if len(s.nodeStatusBuffer) == 0 {
		return nil
	}

	startTime := time.Now()
	// Node status updates are partitioned by month, so we need to handle potential partition issues
	err := s.db.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(s.nodeStatusBuffer, 1000).Error
	if err != nil {
		s.log.Errorf("Failed to batch insert node_statuses: %v", err)
		return fmt.Errorf("batch insert node_statuses failed: %w", err)
	}

	s.log.Debugf("Batch inserted %d node_statuses in %v", len(s.nodeStatusBuffer), time.Since(startTime))
	s.nodeStatusBuffer = s.nodeStatusBuffer[:0]
	return nil
}

// Stop gracefully stops the batch insert service
func (s *BatchInsertService) Stop() {
	s.cancel()
	s.wg.Wait()
}