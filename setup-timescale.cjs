const { Pool } = require('pg');
const fs = require('fs');

console.log('🚀 TimescaleDB Setup Script\n');
console.log('This script will help you set up your new TimescaleDB database.\n');

// Instructions for the user
console.log('📋 Instructions:');
console.log('1. Go to https://console.cloud.timescale.com/');
console.log('2. Create a new service (free tier is fine)');
console.log('3. Copy the connection string (postgres://...)');
console.log('4. Update your .env file with the new DATABASE_URL');
console.log('5. Run: npm run db:push');
console.log('6. Run: node setup-timescale.cjs verify\n');

// If user runs with 'verify' argument, test the connection
if (process.argv[2] === 'verify') {
  console.log('🔄 Verifying database connection...\n');

  // Read DATABASE_URL from .env file
  const envContent = fs.readFileSync('.env', 'utf8');
  const databaseUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim();

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    process.exit(1);
  }

  if (databaseUrl.includes('timescale.com:36839')) {
    console.error('❌ Still using old TimescaleDB URL!');
    console.error('   Please update DATABASE_URL in .env with your new TimescaleDB connection string');
    process.exit(1);
  }

  // Disable SSL certificate validation for TimescaleDB
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false
  });

  async function verifyConnection() {
    try {
      // Test connection
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection successful!\n');

      // Check if tables exist
      const tablesResult = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      `);

      if (tablesResult.rows.length === 0) {
        console.log('⚠️  No tables found. Run: npm run db:push');
      } else {
        console.log('📊 Tables found:');
        tablesResult.rows.forEach(row => {
          console.log(`   - ${row.table_name}`);
        });
        console.log('\n✨ Your new TimescaleDB is ready to use!');
        console.log('🔄 Now refresh your Google Sheets data to populate the database.');
      }

    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      console.error('\n💡 Make sure you:');
      console.error('   1. Created a new TimescaleDB service');
      console.error('   2. Updated DATABASE_URL in .env');
      console.error('   3. The service is active (not paused)');
    } finally {
      await pool.end();
    }
  }

  verifyConnection();
} else {
  console.log('💡 After updating your .env file, run:');
  console.log('   node setup-timescale.cjs verify');
}