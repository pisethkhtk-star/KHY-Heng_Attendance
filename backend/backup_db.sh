#!/bin/bash
# ==============================================================================
# HR Chomnan - PostgreSQL Database Backup Script
# ==============================================================================

BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "💾 Starting database backup..."
docker exec hr_attendance_postgres pg_dump -U postgres employee_attendance_db | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
    echo "✅ Backup successfully created at: $BACKUP_DIR/$FILENAME"
    # Keep only the 7 most recent backups
    ls -t "$BACKUP_DIR"/db_backup_*.sql.gz | tail -n +8 | xargs -r rm --
else
    echo "❌ Backup failed!"
fi
