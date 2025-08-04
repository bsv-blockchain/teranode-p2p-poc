#!/bin/bash

# SQLite Database Optimization Script for Teranode P2P Production
# This script applies optimizations to reduce "database is locked" errors

set -e

# Check if database path is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_database.db>"
    echo "Example: $0 /path/to/teranode.db"
    exit 1
fi

DB_PATH="$1"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database file not found: $DB_PATH"
    exit 1
fi

# Create backup
BACKUP_PATH="${DB_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
echo "Creating backup at: $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"

echo "Applying database optimizations..."

# Apply optimizations using sqlite3
sqlite3 "$DB_PATH" < "$(dirname "$0")/optimize_db.sql"

echo "Database optimization complete!"
echo ""
echo "Important notes:"
echo "1. The database is now using WAL mode for better concurrency"
echo "2. Restart your application to use the optimized database"
echo "3. If you need to rollback, restore from: $BACKUP_PATH"
echo ""
echo "To verify the optimization, run:"
echo "sqlite3 $DB_PATH 'PRAGMA journal_mode; PRAGMA synchronous;'"