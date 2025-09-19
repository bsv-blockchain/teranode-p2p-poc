# PostgreSQL Optimized Setup for Teranode P2P

This guide explains how to set up and use the PostgreSQL-optimized version of the Teranode P2P application, designed to handle millions of records with high performance.

## Key Improvements

### Database Optimizations
- **PostgreSQL** replaces SQLite for better concurrency and scalability
- **Table partitioning** by month for efficient data management
- **Composite indexes** for common query patterns
- **BRIN indexes** for time-based queries
- **Materialized views** for fast statistics
- **Batch inserts** (1000 records at a time)
- **Connection pooling** (50 connections)
- **Prepared statements** for query optimization

### Performance Features
- Handles millions of records efficiently
- Sub-second query responses with proper indexing
- Automatic partition creation monthly
- Background stats calculation
- Efficient data cleanup for old partitions
- Concurrent read/write operations

## Quick Start

### 1. Start PostgreSQL with Docker

```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.postgres.yml up -d

# Wait for PostgreSQL to be ready
docker-compose -f docker-compose.postgres.yml ps

# Check logs if needed
docker-compose -f docker-compose.postgres.yml logs postgres
```

### 2. Initialize Database Schema

```bash
# Connect to PostgreSQL and run migration
docker exec -i teranode-postgres psql -U teranode -d teranode_p2p < migrations/001_optimized_schema.sql
```

### 3. Build and Run Application

```bash
# Build with PostgreSQL support
go build -tags postgres -o teranode-p2p-postgres cmd/main_postgres.go

# Copy PostgreSQL config
cp config.postgres.yaml config.yaml

# Run the application
./teranode-p2p-postgres
```

## Configuration

### Database Settings (config.yaml)

```yaml
database:
  host: "localhost"  # or "postgres" for Docker
  port: 5432
  user: "teranode"
  password: "teranode_secure_password"
  name: "teranode_p2p"
  sslmode: "disable"
```

### Performance Tuning

```yaml
performance:
  batch_size: 1000           # Messages per batch insert
  batch_interval: 5          # Seconds between flushes
  stats_interval: 60         # Stats calculation interval
  materialized_view_refresh: 300  # View refresh interval
```

## Database Management

### View Statistics

```bash
# Connect to database
docker exec -it teranode-postgres psql -U teranode -d teranode_p2p

# View table sizes
\dt+

# View partition information
SELECT
    parent.relname AS parent_table,
    child.relname AS partition_name,
    pg_size_pretty(pg_relation_size(child.oid)) AS size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
ORDER BY parent.relname, child.relname;

# View materialized views
\dm+

# Check slow queries
SELECT query, calls, mean_exec_time, max_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Refresh Materialized Views

```sql
-- Manual refresh if needed
SELECT refresh_all_materialized_views();

-- Check last refresh time
SELECT schemaname, matviewname, last_refresh
FROM pg_stat_user_tables
WHERE schemaname = 'public';
```

### Data Cleanup

```sql
-- Drop old partitions (e.g., older than 3 months)
DROP TABLE IF EXISTS blocks_2024_09;
DROP TABLE IF EXISTS handshakes_2024_09;
-- etc. for other tables

-- Vacuum and analyze for performance
VACUUM ANALYZE;
```

## Monitoring

### Using pgAdmin

1. Access pgAdmin at http://localhost:5050
2. Login with:
   - Email: admin@teranode.local
   - Password: admin_password
3. Add server connection:
   - Host: postgres
   - Port: 5432
   - Username: teranode
   - Password: teranode_secure_password

### Performance Metrics

```sql
-- Current connections
SELECT count(*) FROM pg_stat_activity;

-- Database size
SELECT pg_database_size('teranode_p2p');

-- Table sizes
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## API Endpoints

All existing endpoints work with PostgreSQL but with improved performance:

- `/api/blocks` - Query blocks with pagination
- `/api/handshakes` - Query handshakes
- `/api/stats` - Get cached statistics (sub-second response)
- `/api/peers` - List peers with activity
- `/api/block-headers` - Query block headers

## Troubleshooting

### Connection Issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.postgres.yml ps

# View logs
docker-compose -f docker-compose.postgres.yml logs -f postgres

# Test connection
docker exec -it teranode-postgres psql -U teranode -d teranode_p2p -c "SELECT 1;"
```

### Performance Issues

```sql
-- Check for missing indexes
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1
ORDER BY n_distinct DESC;

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM blocks WHERE network = 'mainnet' LIMIT 100;
```

### Reset Database

```bash
# Stop application
# Drop and recreate database
docker exec -it teranode-postgres psql -U teranode -c "DROP DATABASE teranode_p2p;"
docker exec -it teranode-postgres psql -U teranode -c "CREATE DATABASE teranode_p2p;"

# Re-run migration
docker exec -i teranode-postgres psql -U teranode -d teranode_p2p < migrations/001_optimized_schema.sql
```

## Production Recommendations

1. **Use connection pooling** - Consider pgBouncer for very high loads
2. **Enable SSL** - Set `sslmode: require` in production
3. **Regular backups** - Use pg_dump or continuous archiving
4. **Monitor disk space** - Partitions can grow large
5. **Tune PostgreSQL** - Adjust shared_buffers, work_mem based on server RAM
6. **Use read replicas** - For read-heavy workloads
7. **Enable compression** - For archived partitions
8. **Set up alerting** - Monitor slow queries, connection count, disk usage

## Load Testing

```bash
# Generate test load (example)
for i in {1..1000000}; do
    # Simulate message insertion
    echo "INSERT INTO blocks (network, hash, height, peer_id) VALUES ('mainnet', 'hash$i', $i, 'peer123');"
done | docker exec -i teranode-postgres psql -U teranode -d teranode_p2p

# Check performance
docker exec -it teranode-postgres psql -U teranode -d teranode_p2p -c "SELECT COUNT(*) FROM blocks;"
```

## Scaling Further

For even larger scales (10M+ records):

1. **Implement sharding** - Distribute data across multiple PostgreSQL instances
2. **Use TimescaleDB** - PostgreSQL extension optimized for time-series data
3. **Add Elasticsearch** - For complex search queries
4. **Implement data archival** - Move old data to cheaper storage
5. **Use column-store** - Consider CitusDB for analytical queries

This optimized setup can handle millions of records while maintaining fast query performance.