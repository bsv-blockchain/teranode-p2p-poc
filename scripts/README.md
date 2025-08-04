# Database Optimization Scripts

## Production Database Optimization

If you're experiencing "database is locked" errors in production with high message volumes, use these optimization scripts.

### Quick Start

```bash
# Run the optimization script on your production database
./optimize_production_db.sh /path/to/your/teranode.db
```

### What the Optimization Does

1. **Enables WAL Mode**: Write-Ahead Logging allows multiple concurrent readers even while writes are happening
2. **Optimizes SQLite Settings**: Adjusts cache size, synchronous mode, and memory-mapped I/O
3. **Creates Missing Indexes**: Ensures all commonly queried fields have indexes
4. **Runs VACUUM and ANALYZE**: Optimizes database structure and updates statistics

### Manual Optimization

If you prefer to run the SQL commands manually:

```bash
sqlite3 /path/to/your/teranode.db < optimize_db.sql
```

### Application Configuration

The application (main.go) has been updated to automatically use optimal SQLite settings:
- WAL mode enabled by default
- Connection pool limited to 1 connection (required for SQLite)
- Busy timeout set to 5 seconds
- Synchronous mode set to NORMAL

### Monitoring Performance

After optimization, you can check the database settings:

```bash
sqlite3 /path/to/your/teranode.db "PRAGMA journal_mode; PRAGMA synchronous; PRAGMA cache_size;"
```

### Rollback

The optimization script automatically creates a backup before making changes. If you need to rollback, simply restore the backup file.