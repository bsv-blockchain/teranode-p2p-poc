package parser

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"github.com/bsv-blockchain/teranode-p2p-poc/pkg/model"
	"time"
)

// ParseBlockHeader parses a hex-encoded block header and creates a BlockHeader model
func ParseBlockHeader(hexHeader string, network string, receivedAt time.Time) (*model.BlockHeader, error) {
	// Decode hex string to bytes
	headerBytes, err := hex.DecodeString(hexHeader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex header: %w", err)
	}

	// BSV block header is 80 bytes
	if len(headerBytes) != 80 {
		return nil, fmt.Errorf("invalid header length: expected 80 bytes, got %d", len(headerBytes))
	}

	// Parse header fields (little-endian)
	version := int32(binary.LittleEndian.Uint32(headerBytes[0:4]))
	
	// Previous block hash (32 bytes, reversed for display)
	prevHash := reverseBytes(headerBytes[4:36])
	prevHashStr := hex.EncodeToString(prevHash)
	
	// Merkle root (32 bytes, reversed for display)
	merkleRoot := reverseBytes(headerBytes[36:68])
	merkleRootStr := hex.EncodeToString(merkleRoot)
	
	// Timestamp
	timestamp := binary.LittleEndian.Uint32(headerBytes[68:72])
	
	// Bits (difficulty target)
	bits := binary.LittleEndian.Uint32(headerBytes[72:76])
	
	// Nonce
	nonce := binary.LittleEndian.Uint32(headerBytes[76:80])
	
	// Calculate block hash (double SHA256 of header, reversed)
	hash := calculateBlockHash(headerBytes)
	
	// Note: Height is not in the header itself, it would need to be provided separately
	// For now, we'll use 0 as a placeholder - this should be updated when we have the actual height
	
	return &model.BlockHeader{
		Network:      network,
		Hash:         hash,
		Height:       0, // This needs to be set from the Block message
		Version:      version,
		PreviousHash: prevHashStr,
		MerkleRoot:   merkleRootStr,
		Timestamp:    timestamp,
		Bits:         bits,
		Nonce:        nonce,
		ReceivedAt:   receivedAt,
	}, nil
}

// reverseBytes reverses a byte slice (for endianness conversion)
func reverseBytes(data []byte) []byte {
	result := make([]byte, len(data))
	for i := 0; i < len(data); i++ {
		result[i] = data[len(data)-1-i]
	}
	return result
}

// calculateBlockHash calculates the block hash from the header bytes
func calculateBlockHash(headerBytes []byte) string {
	// In a real implementation, this would do double SHA256
	// For now, we'll return a placeholder
	// TODO: Implement proper double SHA256
	return ""
}