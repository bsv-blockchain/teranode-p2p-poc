# Docker Deployment Guide

This guide explains how to build and deploy the Teranode P2P Monitor using Docker and Kubernetes.

## Building the Docker Image

```bash
# Build the Docker image
docker build -t teranode-p2p-poc:latest .

# Or use docker-compose
docker-compose build
```

## Running with Docker

### Using docker run
```bash
# Create a data directory for the SQLite database
mkdir -p ./data

# Run the container
docker run -d \
  --name teranode-p2p \
  -p 8080:8080 \
  -v $(pwd)/config.yaml:/config.yaml:ro \
  -v $(pwd)/data:/data \
  -e TERANODE_P2P_DATABASE_PATH=/data/teranode.db \
  teranode-p2p-poc:latest
```

### Using docker-compose
```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

## Kubernetes Deployment

### Prerequisites
- A Kubernetes cluster (local or cloud)
- kubectl configured to access your cluster
- A container registry to push your image (optional for local testing)

### Deploy to Kubernetes

1. **Push image to registry (if not using local cluster)**
```bash
# Tag and push to your registry
docker tag teranode-p2p-poc:latest your-registry/teranode-p2p-poc:latest
docker push your-registry/teranode-p2p-poc:latest
```

2. **Update the image in k8s-example.yaml**
```yaml
# Edit the image field in the deployment
image: your-registry/teranode-p2p-poc:latest
```

3. **Deploy to Kubernetes**
```bash
# Apply the configuration
kubectl apply -f k8s-example.yaml

# Check deployment status
kubectl get pods -l app=teranode-p2p
kubectl get svc teranode-p2p

# View logs
kubectl logs -l app=teranode-p2p -f
```

4. **Access the application**
- **Port forwarding (for testing)**:
  ```bash
  kubectl port-forward svc/teranode-p2p 8080:80
  # Access at http://localhost:8080
  ```

- **Using Ingress (for production)**:
  - Update the host in the Ingress resource
  - Ensure you have an Ingress controller installed
  - Access via your configured domain

## Configuration

### Environment Variables
The application supports environment variable overrides for configuration:
- `TERANODE_P2P_DATABASE_PATH`: Path to SQLite database file
- `TERANODE_P2P_P2P_BOOTSTRAP_ADDRESSES`: Comma-separated list of bootstrap addresses
- `TERANODE_P2P_P2P_SHARED_KEY`: Shared key for P2P network

### Frontend Configuration
The frontend automatically uses relative URLs when built in production mode, making it work seamlessly in containerized environments:
- API calls: Uses same origin (no hardcoded ports)
- WebSocket: Automatically uses ws:// or wss:// based on the protocol

## Troubleshooting

### Container won't start
- Check logs: `docker logs teranode-p2p`
- Ensure config.yaml is mounted correctly
- Verify database path is writable

### Frontend can't connect to backend
- The frontend uses relative URLs in production builds
- Ensure you're accessing the app through the exposed port (8080)
- Check browser console for errors

### WebSocket connection issues
- WebSocket automatically uses the same host/port as the web page
- For HTTPS deployments, WebSocket will use WSS
- Check that your reverse proxy/ingress supports WebSocket upgrades

## Health Checks
The application provides health endpoints:
- `/` - Returns the frontend (used for liveness/readiness probes)
- `/messages` - API endpoint to verify backend connectivity

## Security Considerations
- The default configuration runs as non-root user (65532)
- Mount config.yaml as read-only
- Use Kubernetes secrets for sensitive configuration
- Consider using network policies to restrict P2P traffic