import postgres from 'postgres';
import { readFileSync } from 'fs';

const sql = postgres('postgres://tsdbadmin:mvsp4u3nxsc33ljt@sd118tp34m.i1hg4hgpo0.tsdb.cloud.timescale.com:36839/tsdb?sslmode=require');

const migrationSQL = readFileSync('./migrations/0000_careless_the_leader.sql', 'utf8');

// Split by statement breakpoint and execute
const statements = migrationSQL.split('--> statement-breakpoint').filter(s => s.trim());

console.log(`Running ${statements.length} migration statements...`);

for (const statement of statements) {
  const trimmed = statement.trim();
  if (trimmed) {
    console.log(`\nExecuting: ${trimmed.substring(0, 50)}...`);
    try {
      await sql.unsafe(trimmed);
      console.log('✅ Success');
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

console.log('\n✅ Migration complete!');
await sql.end();
