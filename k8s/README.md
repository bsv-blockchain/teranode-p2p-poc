# Kubernetes Deployment for Teranode P2P POC

This directory contains Kubernetes manifests for deploying the Teranode P2P POC application with PostgreSQL.

## Prerequisites

- Kubernetes cluster (1.19+)
- kubectl configured to access your cluster
- Docker registry to push your images (or use local images with kind/minikube)
- Storage provisioner for PersistentVolumeClaims

## Components

- **PostgreSQL**: StatefulSet with persistent storage for the database
- **Teranode P2P**: Deployment for the main application
- **ConfigMap**: Application configuration
- **Services**: Expose PostgreSQL and the application
- **Ingress**: (Optional) External HTTP/WebSocket access

## Quick Start

### 1. Build and Push Docker Image

```bash
# Build the Docker image
docker build -t teranode-p2p:latest .

# Tag for your registry (example with Docker Hub)
docker tag teranode-p2p:latest your-registry/teranode-p2p:latest

# Push to registry
docker push your-registry/teranode-p2p:latest
```

### 2. Update Image Reference

Edit `k8s/base/deployment.yaml` and update the image reference:
```yaml
image: your-registry/teranode-p2p:latest
```

### 3. Deploy to Kubernetes

Using kubectl:
```bash
# Deploy all resources
kubectl apply -k k8s/base/

# Or deploy individual files
kubectl apply -f k8s/base/namespace.yaml
kubectl apply -f k8s/base/postgres.yaml
kubectl apply -f k8s/base/configmap.yaml
kubectl apply -f k8s/base/deployment.yaml
kubectl apply -f k8s/base/ingress.yaml  # Optional
```

Using Kustomize:
```bash
# Preview what will be deployed
kubectl kustomize k8s/base/

# Apply the configuration
kubectl apply -k k8s/base/
```

### 4. Verify Deployment

```bash
# Check if pods are running
kubectl get pods -n teranode

# Check services
kubectl get svc -n teranode

# Check logs
kubectl logs -n teranode deployment/teranode-p2p
kubectl logs -n teranode statefulset/postgres

# Access the application (if using LoadBalancer)
kubectl get svc -n teranode teranode-p2p
```

## Configuration

### Database Connection

The application automatically connects to PostgreSQL using:
- Host: `postgres` (Kubernetes service name)
- Port: `5432`
- Database: `teranode_p2p`
- User: `teranode`
- Password: `teranode` (stored in Secret)

### Application Settings

Modify `k8s/base/configmap.yaml` to adjust:
- P2P network settings
- Bootstrap addresses
- Networks to monitor
- Topics to subscribe

### Storage

The PostgreSQL database uses a PersistentVolumeClaim. Adjust the storage class in `postgres.yaml`:
```yaml
storageClassName: standard  # Change based on your cluster
```

Common storage classes:
- **AWS EKS**: `gp2`, `gp3`
- **GKE**: `standard`, `standard-rwo`
- **Azure AKS**: `managed`, `managed-premium`
- **Minikube**: `standard`
- **Kind**: `standard`

### Ingress

If using Ingress instead of LoadBalancer:

1. Update the hostname in `ingress.yaml`:
```yaml
host: your-domain.com
```

2. Change the service type in `deployment.yaml`:
```yaml
type: ClusterIP  # Instead of LoadBalancer
```

3. Ensure you have an Ingress controller installed (e.g., nginx-ingress)

## Access Methods

### Port-Forward (Development)

```bash
# Access web UI
kubectl port-forward -n teranode svc/teranode-p2p 8080:80

# Access PostgreSQL
kubectl port-forward -n teranode svc/postgres 5432:5432
```

Then access: http://localhost:8080

### LoadBalancer

Get the external IP:
```bash
kubectl get svc -n teranode teranode-p2p
```

### Ingress

Access via your configured domain (e.g., http://teranode.example.com)

## Database Migrations

**The application automatically performs database migrations on startup.** The GORM AutoMigrate function in the application will:
- Create all necessary tables
- Create monthly partitions for time-series data
- Set up indexes and constraints

No manual database setup is required.

## Monitoring

### Logs

```bash
# Application logs
kubectl logs -n teranode -l app=teranode-p2p -f

# PostgreSQL logs
kubectl logs -n teranode -l app=postgres -f
```

### Health Checks

The application exposes health endpoints:
- Liveness: `/api/stats`
- Readiness: `/api/stats`

## Scaling

### Application Replicas

```bash
kubectl scale deployment/teranode-p2p -n teranode --replicas=3
```

Note: P2P networking may require additional configuration for multiple replicas.

### PostgreSQL

For production, consider:
- Using a managed database service (RDS, Cloud SQL, Azure Database)
- Implementing PostgreSQL replication
- Setting up regular backups

## Troubleshooting

### Pod not starting

```bash
# Check pod status
kubectl describe pod -n teranode <pod-name>

# Check events
kubectl get events -n teranode --sort-by='.lastTimestamp'
```

### Database connection issues

```bash
# Test PostgreSQL connection
kubectl run -it --rm --image=postgres:15-alpine psql-test -n teranode -- \
  psql -h postgres -U teranode -d teranode_p2p -c "SELECT 1"
```

### Storage issues

```bash
# Check PVC status
kubectl get pvc -n teranode

# Check PV status
kubectl get pv
```

## Clean Up

```bash
# Delete all resources
kubectl delete -k k8s/base/

# Or delete namespace (removes everything)
kubectl delete namespace teranode
```

## Production Considerations

1. **Secrets**: Use sealed-secrets or external secret management (Vault, AWS Secrets Manager)
2. **Database**: Use managed PostgreSQL service for production
3. **Monitoring**: Add Prometheus metrics and Grafana dashboards
4. **Backup**: Implement database backup strategy
5. **TLS**: Enable HTTPS with cert-manager
6. **Resource Limits**: Adjust CPU/memory based on load
7. **Autoscaling**: Configure HPA for the application deployment
8. **Network Policies**: Implement network segmentation

## Environment Variables

The application supports environment variable overrides using the prefix `TERANODE_P2P_`:

```yaml
env:
- name: TERANODE_P2P_DATABASE_HOST
  value: "postgres"
- name: TERANODE_P2P_DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: postgres-secret
      key: postgres-password
```