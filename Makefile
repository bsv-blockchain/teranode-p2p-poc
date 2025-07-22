# Variables
BINARY_NAME=teranode-p2p-poc
FRONTEND_DIR=frontend-react
BUILD_DIR=build

# Default target
.PHONY: all
all: build-frontend build-go

# Help target
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  all              - Build React frontend and Go binary"
	@echo "  run              - Build and run the application"
	@echo "  dev              - Start development mode (Go server + React dev server)"
	@echo "  build-frontend   - Build React application for production"
	@echo "  build-go         - Build Go binary"
	@echo "  install-frontend - Install React dependencies"
	@echo "  test-frontend    - Run React tests"
	@echo "  clean            - Clean build artifacts"
	@echo "  docker-build     - Build Docker image"
	@echo "  docker-run       - Run Docker container"
	@echo "  help             - Show this help message"

# Install React dependencies
.PHONY: install-frontend
install-frontend:
	@echo "Installing React dependencies..."
	cd $(FRONTEND_DIR) && npm install

# Build React application for production
.PHONY: build-frontend
build-frontend: install-frontend
	@echo "Building React application..."
	cd $(FRONTEND_DIR) && npm run build

# Build Go binary
.PHONY: build-go
build-go:
	@echo "Building Go application..."
	go mod tidy
	go build -o $(BINARY_NAME) cmd/main.go

# Build everything
.PHONY: build
build: build-frontend build-go

# Run the application (build first if needed)
.PHONY: run
run: build
	@echo "Starting teranode-p2p-poc server..."
	@if [ ! -f config.yaml ]; then \
		echo "Warning: config.yaml not found. Make sure to create it before running."; \
	fi
	./$(BINARY_NAME)

# Development mode - start Go server and React dev server concurrently
.PHONY: dev
dev: install-frontend
	@echo "Starting development servers..."
	@echo "Go server will run on :8080, React dev server on :3000"
	@echo "Open http://localhost:3000 for development or http://localhost:8080 for production build"
	@if [ ! -f config.yaml ]; then \
		echo "Warning: config.yaml not found. Make sure to create it before running."; \
	fi
	@trap 'kill %1 %2' EXIT; \
	(cd $(FRONTEND_DIR) && npm start) & \
	go run cmd/main.go & \
	wait

# Quick development start (Go server only, assumes React is built)
.PHONY: dev-go
dev-go:
	@echo "Starting Go server in development mode..."
	@if [ ! -f config.yaml ]; then \
		echo "Warning: config.yaml not found. Make sure to create it before running."; \
	fi
	go run cmd/main.go

# Test React application
.PHONY: test-frontend
test-frontend:
	@echo "Running React tests..."
	cd $(FRONTEND_DIR) && npm test -- --watchAll=false

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -f $(BINARY_NAME)
	rm -rf $(FRONTEND_DIR)/build
	rm -rf $(FRONTEND_DIR)/node_modules

# Docker targets
.PHONY: docker-build
docker-build:
	@echo "Building Docker image..."
	docker build -t $(BINARY_NAME) .

.PHONY: docker-run
docker-run:
	@echo "Running Docker container..."
	@if [ ! -f config.yaml ]; then \
		echo "Error: config.yaml not found. Create it first."; \
		exit 1; \
	fi
	docker run -p 8080:8080 -v $(PWD)/config.yaml:/config.yaml $(BINARY_NAME)

# Development shortcuts
.PHONY: start
start: run

.PHONY: serve
serve: run