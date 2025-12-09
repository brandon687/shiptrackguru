import postgres from 'postgres';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

// Disable SSL certificate validation for TimescaleDB
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function setupDatabase() {
  console.log('Connecting to TimescaleDB...');

  const sql = postgres(process.env.DATABASE_URL, {
    max: 1,
    ssl: 'require',
  });

  try {
    // First, let's check if we can connect
    const result = await sql`SELECT current_database(), current_user, version()`;
    console.log('Connected successfully!');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);

    // Drop existing tables if they exist (clean slate for new DB)
    console.log('\nDropping existing tables if they exist...');
    await sql`DROP TABLE IF EXISTS shipments CASCADE`;
    await sql`DROP TABLE IF EXISTS tracking_numbers CASCADE`;
    await sql`DROP TABLE IF EXISTS fedex_credentials CASCADE`;

    // Create shipments table
    console.log('\nCreating shipments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS shipments (
        id SERIAL PRIMARY KEY,
        master_tracking_number TEXT NOT NULL,
        recipient_name TEXT,
        address TEXT,
        scheduled_delivery TIMESTAMP,
        actual_delivery TIMESTAMP,
        status TEXT DEFAULT 'pending',
        status_description TEXT,
        carrier TEXT DEFAULT 'FedEx',
        manually_completed INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        completed_by TEXT,
        scanning_in_progress BOOLEAN DEFAULT FALSE,
        scanning_user TEXT,
        not_scanned BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create tracking_numbers table
    console.log('Creating tracking_numbers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS tracking_numbers (
        id SERIAL PRIMARY KEY,
        tracking_number TEXT NOT NULL UNIQUE,
        shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
        is_master BOOLEAN DEFAULT FALSE,
        scanned_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create fedex_credentials table
    console.log('Creating fedex_credentials table...');
    await sql`
      CREATE TABLE IF NOT EXISTS fedex_credentials (
        id SERIAL PRIMARY KEY,
        api_key TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    console.log('\nCreating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_shipments_master_tracking ON shipments(master_tracking_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tracking_numbers_tracking ON tracking_numbers(tracking_number)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tracking_numbers_shipment ON tracking_numbers(shipment_id)`;

    console.log('\n✅ Database setup completed successfully!');

    // Verify tables were created
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    console.log('\nCreated tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));

  } catch (error) {
    console.error('Error setting up database:', error);
    throw error;
  } finally {
    await sql.end();
    console.log('\nDatabase connection closed.');
  }
}

// Run the setup
setupDatabase().catch(console.error);