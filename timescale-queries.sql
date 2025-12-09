-- View all tables in your database
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- View all shipments
SELECT * FROM shipments;

-- Count records in each table
SELECT 'shipments' as table_name, COUNT(*) as count FROM shipments
UNION ALL
SELECT 'delivered_shipments', COUNT(*) FROM delivered_shipments
UNION ALL
SELECT 'scanned_sessions', COUNT(*) FROM scanned_sessions
UNION ALL
SELECT 'sync_logs', COUNT(*) FROM sync_logs
UNION ALL
SELECT 'users', COUNT(*) FROM users;

-- View recent shipments with details
SELECT
    tracking_number,
    status,
    status_description,
    package_count,
    scheduled_delivery,
    last_update
FROM shipments
ORDER BY last_update DESC
LIMIT 20;

-- View today's shipments
SELECT * FROM shipments
WHERE DATE(last_update) = CURRENT_DATE;

-- View pending shipments
SELECT * FROM shipments
WHERE status = 'pending';

-- View delivered shipments archive
SELECT * FROM delivered_shipments;

-- View scanning sessions
SELECT * FROM scanned_sessions
ORDER BY timestamp DESC;