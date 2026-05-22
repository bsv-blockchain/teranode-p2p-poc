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
	TypeNodeStatus MessageType = "node_status"
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
	// Format: bitcoin/{network}-{message_type} or bitcoin/{network}-node_status
	parts := strings.Split(topic, "/")
	if len(parts) != 4 || parts[0] != "teranode" {
		return nil, fmt.Errorf("invalid topic format: %s", topic)
	}

	var network string
	var messageType string

	// Check if it's a node_status message (special case without network prefix)
	if parts[1] == "node_status" {
		network = "all" // node_status applies to all networks
		messageType = "node_status"
	} else {
		networkParts := strings.Split(parts[3], "-")
		if len(networkParts) < 2 {
			return nil, fmt.Errorf("invalid network-type format: %s", parts[1])
		}

		network = networkParts[0]
		// Handle multi-part message types like node_status
		messageType = strings.Join(networkParts[1:], "_")
	}

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

	case "node_status":
		result.Type = TypeNodeStatus
		var msg NodeStatusMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			return nil, fmt.Errorf("failed to parse node_status message: %w", err)
		}
		result.Data = msg

	default:
		return nil, fmt.Errorf("unknown message type: %s", messageType)
	}

	return result, nil
}

// GetNetworks returns all supported networks
func GetNetworks() []string {
	return []string{"mainnet", "testnet", "teratestnet"}
}

// GetMessageTypes returns all supported message types
func GetMessageTypes() []string {
	return []string{"block", "subtree", "node_status"}
}

// GenerateTopics generates all topic combinations for the given networks
func GenerateTopics(networks []string) []string {
	messageTypes := GetMessageTypes()
	topics := make([]string, 0, len(networks)*len(messageTypes))

	for _, network := range networks {
		for _, msgType := range messageTypes {
			topics = append(topics, fmt.Sprintf("teranode/bitcoin/1.0.0/%s-%s", network, msgType))
		}
	}

	return topics
}
