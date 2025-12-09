const { Pool } = require('pg');
const fs = require('fs');

// Disable SSL certificate validation for TimescaleDB
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

console.log('🔍 DATABASE VALIDATION REPORT\n');
console.log('=' .repeat(50));

// Read DATABASE_URL from .env file
const envContent = fs.readFileSync('.env', 'utf8');
const databaseUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim();

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Parse the connection string
const urlParts = databaseUrl.match(/postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
if (urlParts) {
  console.log('\n📊 CONNECTION DETAILS:');
  console.log(`   Host: ${urlParts[3]}`);
  console.log(`   Port: ${urlParts[4]}`);
  console.log(`   Database: ${urlParts[5].split('?')[0]}`);
  console.log(`   User: ${urlParts[1]}`);
  console.log(`   SSL: ${databaseUrl.includes('sslmode=require') ? 'Required' : 'Not Required'}`);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
});

async function validateDatabase() {
  try {
    // Test connection
    console.log('\n🔌 CONNECTION TEST:');
    const connectResult = await pool.query('SELECT NOW() as time, current_database() as db, current_user as user');
    console.log(`   ✅ Connected successfully`);
    console.log(`   Database: ${connectResult.rows[0].db}`);
    console.log(`   User: ${connectResult.rows[0].user}`);
    console.log(`   Server Time: ${connectResult.rows[0].time}`);

    // Check tables
    console.log('\n📋 TABLE STRUCTURE:');
    const tablesResult = await pool.query(`
      SELECT
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length === 0) {
      console.log('   ⚠️  No tables found');
    } else {
      for (const table of tablesResult.rows) {
        // Get row count for each table
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        console.log(`   • ${table.table_name}: ${table.column_count} columns, ${countResult.rows[0].count} rows`);
      }
    }

    // Check indexes
    console.log('\n🔍 INDEXES:');
    const indexResult = await pool.query(`
      SELECT
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    if (indexResult.rows.length === 0) {
      console.log('   ⚠️  No indexes found');
    } else {
      let currentTable = '';
      for (const idx of indexResult.rows) {
        if (idx.tablename !== currentTable) {
          currentTable = idx.tablename;
          console.log(`   ${idx.tablename}:`);
        }
        console.log(`     - ${idx.indexname}`);
      }
    }

    // Test CRUD operations
    console.log('\n🧪 CRUD OPERATIONS TEST:');

    // Test INSERT
    const insertResult = await pool.query(`
      INSERT INTO shipments (tracking_number, status, package_count)
      VALUES ('VALIDATION_TEST_' || gen_random_uuid(), 'test', 1)
      RETURNING id, tracking_number
    `);
    console.log(`   ✅ INSERT: Created test record ${insertResult.rows[0].tracking_number}`);

    // Test SELECT
    const selectResult = await pool.query(`
      SELECT * FROM shipments WHERE id = $1
    `, [insertResult.rows[0].id]);
    console.log(`   ✅ SELECT: Retrieved test record`);

    // Test UPDATE
    await pool.query(`
      UPDATE shipments SET status = 'updated' WHERE id = $1
    `, [insertResult.rows[0].id]);
    console.log(`   ✅ UPDATE: Modified test record`);

    // Test DELETE
    await pool.query(`
      DELETE FROM shipments WHERE id = $1
    `, [insertResult.rows[0].id]);
    console.log(`   ✅ DELETE: Removed test record`);

    // Database size
    console.log('\n💾 DATABASE SIZE:');
    const sizeResult = await pool.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size
    `);
    console.log(`   Total Size: ${sizeResult.rows[0].size}`);

    // Check TimescaleDB specific features if available
    console.log('\n⏰ TIMESCALEDB CHECK:');
    try {
      const tsResult = await pool.query(`
        SELECT extname, extversion
        FROM pg_extension
        WHERE extname = 'timescaledb'
      `);
      if (tsResult.rows.length > 0) {
        console.log(`   ✅ TimescaleDB ${tsResult.rows[0].extversion} installed`);
      } else {
        console.log('   ℹ️  TimescaleDB extension not installed (using regular PostgreSQL)');
      }
    } catch (e) {
      console.log('   ℹ️  Unable to check TimescaleDB extension');
    }

    console.log('\n' + '=' .repeat(50));
    console.log('✅ DATABASE VALIDATION COMPLETE - ALL TESTS PASSED!');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('\n❌ VALIDATION FAILED:', error.message);
    console.error('\nError Details:', error);
  } finally {
    await pool.end();
  }
}

validateDatabase();