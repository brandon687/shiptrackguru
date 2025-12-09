-- COPY AND PASTE THESE INTO TIMESCALEDB SQL EDITOR

-- 1. View all shipments
SELECT * FROM shipments;

-- 2. Count total shipments
SELECT COUNT(*) as total FROM shipments;

-- 3. View shipments with key details
SELECT
    tracking_number,
    status,
    status_description,
    recipient_name,
    package_count,
    scheduled_delivery,
    last_update
FROM shipments
ORDER BY last_update DESC;

-- 4. View by status
SELECT status, COUNT(*) as count
FROM shipments
GROUP BY status;

-- 5. View today's shipments
SELECT * FROM shipments
WHERE DATE(last_update) = CURRENT_DATE;