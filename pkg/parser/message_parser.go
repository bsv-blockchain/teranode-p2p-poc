package parser

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/bsv-blockchain/go-p2p"
)

// MessageType represents the type of message
type MessageType string

const (
	TypeBestBlock  MessageType = "bestblock"
	TypeBlock      MessageType = "block"
	TypeMiningOn   MessageType = "miningon"
	TypeSubtree    MessageType = "subtree"
	TypeHandshake  MessageType = "handshake"
	TypeRejectedTx MessageType = "rejected_tx"
)

// ParsedMessage represents a parsed message with its type and data
type ParsedMessage struct {
	Type    MessageType
	Network string
	Data    interface{}
}

// ParseMessage parses a message based on the topic and returns the typed message
func ParseMessage(topic string, data []byte) (*ParsedMessage, error) {
	// Extract network and message type from topic
	// Format: bitcoin/{network}-{message_type}
	parts := strings.Split(topic, "/")
	if len(parts) != 2 || parts[0] != "bitcoin" {
		return nil, fmt.Errorf("invalid topic format: %s", topic)
	}

	networkParts := strings.Split(parts[1], "-")
	if len(networkParts) != 2 {
		return nil, fmt.Errorf("invalid network-type format: %s", parts[1])
	}

	network := networkParts[0]
	messageType := networkParts[1]

	result := &ParsedMessage{
		Network: network,
	}

	// Parse based on message type
	switch messageType {
	case "bestblock":
		result.Type = TypeBestBlock
		var msg p2p.BestBlockRequestMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse bestblock message: %w", err)
		}
		result.Data = msg

	case "block":
		result.Type = TypeBlock
		var msg p2p.BlockMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse block message: %w", err)
		}
		result.Data = msg

	case "miningon":
		result.Type = TypeMiningOn
		var msg p2p.MiningOnMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse mining_on message: %w", err)
		}
		result.Data = msg

	case "subtree":
		result.Type = TypeSubtree
		var msg p2p.SubtreeMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse subtree message: %w", err)
		}
		result.Data = msg

	case "handshake":
		result.Type = TypeHandshake
		var msg p2p.HandshakeMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse handshake message: %w", err)
		}
		result.Data = msg

	case "rejected_tx":
		result.Type = TypeRejectedTx
		var msg p2p.RejectedTxMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse rejected_tx message: %w", err)
		}
		result.Data = msg

	default:
		return nil, fmt.Errorf("unknown message type: %s", messageType)
	}

	return result, nil
}

// GetNetworks returns all supported networks
func GetNetworks() []string {
	// Return only the networks we want to show in the UI
	return []string{"mainnet", "testnet", "teratestnet", "tstn"}
}

// GetMessageTypes returns all supported message types
func GetMessageTypes() []string {
	// Temporarily removing "miningon" from visible message types
	// return []string{"bestblock", "block", "miningon", "subtree", "handshake", "rejected_tx"}
	return []string{"bestblock", "block", "subtree", "handshake", "rejected_tx"}
}

// GenerateTopics generates all topic combinations for the given networks
func GenerateTopics(networks []string) []string {
	messageTypes := GetMessageTypes()
	topics := make([]string, 0, len(networks)*len(messageTypes))

	for _, network := range networks {
		for _, msgType := range messageTypes {
			topics = append(topics, fmt.Sprintf("bitcoin/%s-%s", network, msgType))
		}
	}

	return topics
}
