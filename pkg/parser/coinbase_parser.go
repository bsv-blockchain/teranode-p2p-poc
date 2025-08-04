package parser

import (
	"encoding/hex"
	"fmt"
	"strings"
	"unicode"
)

// CoinbaseData represents parsed coinbase transaction data
type CoinbaseData struct {
	TxID         string
	TotalValue   uint64 // Total output value in satoshis
	Script       string // Hex-encoded coinbase script
	Text         string // Decoded ASCII text from script
	MinerAddress string // Primary miner address if identifiable
}

// ParseCoinbaseScript extracts readable text from a coinbase script
func ParseCoinbaseScript(scriptHex string) string {
	// Decode hex to bytes
	scriptBytes, err := hex.DecodeString(scriptHex)
	if err != nil {
		return ""
	}

	// Extract printable ASCII characters
	var text strings.Builder
	for _, b := range scriptBytes {
		if b >= 32 && b <= 126 { // Printable ASCII range
			text.WriteByte(b)
		} else if text.Len() > 0 && text.String()[text.Len()-1] != ' ' {
			// Add space between non-printable sections
			text.WriteByte(' ')
		}
	}

	// Clean up the text
	result := strings.TrimSpace(text.String())
	
	// Remove excessive spaces
	result = strings.Join(strings.Fields(result), " ")
	
	return result
}

// ExtractMinerInfo attempts to identify common mining pool signatures
func ExtractMinerInfo(coinbaseText string) string {
	// Common mining pool patterns
	poolPatterns := map[string][]string{
		"TAAL":         {"TAAL", "taal"},
		"GorillaPool":  {"GorillaPool", "Gorilla"},
		"SVPool":       {"SVPool", "svpool"},
		"ViaBTC":       {"ViaBTC", "viabtc"},
		"Mining-Dutch": {"Mining-Dutch", "mining-dutch"},
		"Mempool":      {"mempool", "Mempool"},
	}

	lowerText := strings.ToLower(coinbaseText)
	
	for poolName, patterns := range poolPatterns {
		for _, pattern := range patterns {
			if strings.Contains(lowerText, strings.ToLower(pattern)) {
				return poolName
			}
		}
	}

	// Look for other identifying information
	if strings.Contains(coinbaseText, "Mined by") {
		parts := strings.Split(coinbaseText, "Mined by")
		if len(parts) > 1 {
			// Extract the next word/phrase
			miner := strings.TrimSpace(parts[1])
			words := strings.Fields(miner)
			if len(words) > 0 {
				return words[0]
			}
		}
	}

	return ""
}

// CalculateBlockReward calculates the expected block reward for a given height
func CalculateBlockReward(height uint32) uint64 {
	// BSV block reward schedule
	// Initial reward: 50 BSV = 5,000,000,000 satoshis
	// Halving every 210,000 blocks
	
	const initialReward = uint64(5000000000) // 50 BSV in satoshis
	const halvingInterval = uint32(210000)
	
	halvings := height / halvingInterval
	
	// Block reward halves every 210,000 blocks
	reward := initialReward
	for i := uint32(0); i < halvings; i++ {
		reward = reward / 2
	}
	
	return reward
}

// ExtractCoinbaseValue calculates the total coinbase value including fees
func ExtractCoinbaseValue(outputs []Output) uint64 {
	var total uint64
	for _, output := range outputs {
		total += output.Value
	}
	return total
}

// ExtractMinerAddress attempts to extract the miner's address from outputs
func ExtractMinerAddress(outputs []Output) string {
	// Usually the first output (or the largest one) goes to the miner
	if len(outputs) == 0 {
		return ""
	}

	// Look for the output with addresses
	for _, output := range outputs {
		if len(output.ScriptPubKey.Addresses) > 0 {
			return output.ScriptPubKey.Addresses[0]
		}
	}

	return ""
}

// Output represents a transaction output (imported from datahub package)
type Output struct {
	Value        uint64 `json:"value"`
	Script       string `json:"script"`
	ScriptPubKey struct {
		Type      string   `json:"type"`
		Addresses []string `json:"addresses,omitempty"`
	} `json:"scriptPubKey,omitempty"`
}

// IsASCII checks if a string contains only ASCII printable characters
func IsASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII || !unicode.IsPrint(r) {
			return false
		}
	}
	return true
}

// CleanCoinbaseText removes non-printable characters and cleans up the text
func CleanCoinbaseText(text string) string {
	// Remove null bytes and other control characters
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) || r == ' ' {
			return r
		}
		return -1
	}, text)
	
	// Trim and remove excessive whitespace
	cleaned = strings.TrimSpace(cleaned)
	cleaned = strings.Join(strings.Fields(cleaned), " ")
	
	return cleaned
}