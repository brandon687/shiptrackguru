import { Router } from 'express';
import { sql } from '../db';

const router = Router();

// Health check endpoint for database connectivity
router.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    const result = await sql`SELECT NOW() as current_time, version() as pg_version`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        currentTime: result[0].current_time,
        version: result[0].pg_version,
      },
      ssl: {
        required: true,
        minVersion: 'TLSv1.2',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

// Database metrics endpoint
router.get('/api/health/db-metrics', async (req, res) => {
  try {
    // Get connection stats
    const stats = await sql`
      SELECT
        numbackends as active_connections,
        xact_commit as transactions_committed,
        xact_rollback as transactions_rolled_back,
        blks_read as blocks_read,
        blks_hit as blocks_hit,
        tup_returned as tuples_returned,
        tup_fetched as tuples_fetched,
        tup_inserted as tuples_inserted,
        tup_updated as tuples_updated,
        tup_deleted as tuples_deleted
      FROM pg_stat_database
      WHERE datname = current_database()
    `;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      metrics: stats[0],
    });
  } catch (error) {
    console.error('Failed to fetch database metrics:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;