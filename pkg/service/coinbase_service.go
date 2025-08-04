package service

import (
	"fmt"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/datahub"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/parser"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
	"time"
)

// CoinbaseService handles fetching and processing coinbase transaction data
type CoinbaseService struct {
	db         *gorm.DB
	datahubClient *datahub.Client
	log        *logrus.Logger
}

// NewCoinbaseService creates a new coinbase service
func NewCoinbaseService(db *gorm.DB, log *logrus.Logger) *CoinbaseService {
	return &CoinbaseService{
		db:            db,
		datahubClient: datahub.NewClient(),
		log:           log,
	}
}

// ProcessBlockCoinbase fetches and processes coinbase data for a block
func (s *CoinbaseService) ProcessBlockCoinbase(block *model.Block) error {
	if block.DataHubURL == "" {
		s.log.Debugf("No DataHubURL for block %s, skipping coinbase processing", block.Hash)
		return nil
	}

	// Check if we already have coinbase data for this block
	var blockHeader model.BlockHeader
	if err := s.db.Where("hash = ? AND network = ?", block.Hash, block.Network).First(&blockHeader).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Block header doesn't exist yet - this is expected for blocks received before the header parsing feature was added
			s.log.Debugf("Block header not found for %s (network: %s), skipping coinbase processing", block.Hash, block.Network)
			return nil
		}
		s.log.Errorf("Failed to query block header for %s: %v", block.Hash, err)
		return err
	}

	// Skip if we already have coinbase data
	if blockHeader.CoinbaseTxID != "" {
		s.log.Debugf("Coinbase data already exists for block %s", block.Hash)
		return nil
	}

	// Fetch block data from data hub
	blockData, err := s.datahubClient.GetBlock(block.DataHubURL, block.Hash)
	if err != nil {
		s.log.Errorf("Failed to fetch block data from %s: %v", block.DataHubURL, err)
		return err
	}

	// Get coinbase transaction
	coinbaseTx := datahub.GetCoinbaseTransaction(blockData)
	if coinbaseTx == nil {
		s.log.Errorf("No coinbase transaction found in block %s", block.Hash)
		return fmt.Errorf("no coinbase transaction found")
	}

	// Extract coinbase data
	coinbaseData := s.extractCoinbaseData(coinbaseTx, block.Height)

	// Update block header with coinbase data
	updates := map[string]interface{}{
		"coinbase_tx_id":  coinbaseData.TxID,
		"coinbase_value":  coinbaseData.TotalValue,
		"coinbase_script": coinbaseData.Script,
		"coinbase_text":   coinbaseData.Text,
		"miner_address":   coinbaseData.MinerAddress,
	}

	if err := s.db.Model(&blockHeader).Updates(updates).Error; err != nil {
		s.log.Errorf("Failed to update block header with coinbase data: %v", err)
		return err
	}

	s.log.Infof("Successfully processed coinbase for block %s (height: %d, value: %d sats)",
		block.Hash, block.Height, coinbaseData.TotalValue)

	return nil
}

// extractCoinbaseData extracts relevant data from a coinbase transaction
func (s *CoinbaseService) extractCoinbaseData(tx *datahub.Transaction, height uint32) *parser.CoinbaseData {
	data := &parser.CoinbaseData{
		TxID: tx.TxID,
	}

	// Get coinbase script from input
	if len(tx.Inputs) > 0 && tx.Inputs[0].Coinbase != "" {
		data.Script = tx.Inputs[0].Coinbase
		data.Text = parser.ParseCoinbaseScript(data.Script)
		
		// Try to identify miner from text
		minerInfo := parser.ExtractMinerInfo(data.Text)
		if minerInfo != "" {
			data.MinerAddress = minerInfo + " (Pool)"
		}
	}

	// Convert datahub outputs to parser outputs
	var outputs []parser.Output
	for _, out := range tx.Outputs {
		outputs = append(outputs, parser.Output{
			Value:        out.Value,
			Script:       out.Script,
			ScriptPubKey: out.ScriptPubKey,
		})
	}

	// Calculate total value
	data.TotalValue = parser.ExtractCoinbaseValue(outputs)

	// Extract miner address if not already identified
	if data.MinerAddress == "" {
		data.MinerAddress = parser.ExtractMinerAddress(outputs)
	}

	// Clean up the text
	data.Text = parser.CleanCoinbaseText(data.Text)

	return data
}

// ProcessPendingBlocks processes blocks that don't have coinbase data yet
func (s *CoinbaseService) ProcessPendingBlocks() {
	// Find blocks that have block headers but no coinbase data
	var blocks []model.Block
	query := s.db.Joins("INNER JOIN block_headers ON blocks.hash = block_headers.hash AND blocks.network = block_headers.network").
		Where("block_headers.coinbase_tx_id IS NULL OR block_headers.coinbase_tx_id = ''").
		Where("blocks.data_hub_url != ''").
		Order("blocks.height DESC"). // Process newest blocks first
		Limit(10) // Process 10 at a time

	if err := query.Find(&blocks).Error; err != nil {
		s.log.Errorf("Failed to find pending blocks: %v", err)
		return
	}

	if len(blocks) > 0 {
		s.log.Infof("Found %d blocks to process for coinbase data", len(blocks))
	}

	for _, block := range blocks {
		if err := s.ProcessBlockCoinbase(&block); err != nil {
			// Only log actual errors, not expected "not found" cases
			if err != gorm.ErrRecordNotFound {
				s.log.Errorf("Failed to process coinbase for block %s: %v", block.Hash, err)
			}
			// Continue with next block
		}
		
		// Small delay to avoid overwhelming the data hub
		time.Sleep(100 * time.Millisecond)
	}
}