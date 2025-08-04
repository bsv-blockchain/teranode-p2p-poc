package datahub

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client represents a client for fetching data from BSV data hubs
type Client struct {
	httpClient *http.Client
}

// NewClient creates a new data hub client
func NewClient() *Client {
	return &Client{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// BlockResponse represents the response from data hub for a block
type BlockResponse struct {
	Hash         string        `json:"hash"`
	Height       int           `json:"height"`
	Version      int           `json:"version"`
	Size         int           `json:"size"`
	Timestamp    int64         `json:"timestamp"`
	Transactions []Transaction `json:"transactions"`
}

// Transaction represents a transaction in the block
type Transaction struct {
	TxID     string   `json:"txid"`
	Version  int      `json:"version"`
	Size     int      `json:"size"`
	Inputs   []Input  `json:"inputs"`
	Outputs  []Output `json:"outputs"`
	LockTime int      `json:"locktime"`
}

// Input represents a transaction input
type Input struct {
	Coinbase string `json:"coinbase,omitempty"` // Only present in coinbase transactions
	TxID     string `json:"txid,omitempty"`
	Vout     int    `json:"vout,omitempty"`
	Script   string `json:"script,omitempty"`
	Sequence uint32 `json:"sequence"`
}

// Output represents a transaction output
type Output struct {
	Value        uint64 `json:"value"` // Value in satoshis
	Script       string `json:"script"`
	ScriptPubKey struct {
		Type      string   `json:"type"`
		Addresses []string `json:"addresses,omitempty"`
	} `json:"scriptPubKey,omitempty"`
}

// GetBlock fetches block data from the data hub
func (c *Client) GetBlock(dataHubURL string, blockHash string) (*BlockResponse, error) {
	if dataHubURL == "" {
		return nil, fmt.Errorf("data hub URL is empty")
	}

	// Construct the URL for fetching block data
	// Note: The exact endpoint format depends on the data hub implementation
	// This is a common pattern for BSV data hubs
	url := fmt.Sprintf("%s/block/%s", dataHubURL, blockHash)

	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch block: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(body))
	}

	var block BlockResponse
	if err := json.NewDecoder(resp.Body).Decode(&block); err != nil {
		return nil, fmt.Errorf("failed to decode block response: %w", err)
	}

	return &block, nil
}

// GetCoinbaseTransaction extracts the coinbase transaction from a block
func GetCoinbaseTransaction(block *BlockResponse) *Transaction {
	if len(block.Transactions) == 0 {
		return nil
	}

	// The first transaction in a block is always the coinbase transaction
	tx := &block.Transactions[0]
	
	// Verify it's a coinbase transaction
	if len(tx.Inputs) == 1 && tx.Inputs[0].Coinbase != "" {
		return tx
	}

	return nil
}