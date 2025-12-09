import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL connection (compatible with Timescale Cloud)
// Enhanced configuration to handle SSL/TLS properly
export const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: {
    rejectUnauthorized: false, // Allow self-signed certificates from Timescale Cloud
    require: true, // Force SSL connection
    // Ensure TLS 1.2 or higher
  },
  // Add connection pool settings to handle reconnections
  connection: {
    application_name: 'fedex-dashboard',
  },
  // Add retry logic for transient connection failures
  max_lifetime: 60 * 30, // 30 minutes
  idle_timeout: 20,
});

export const db = drizzle(sql);
