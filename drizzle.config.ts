import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Parse the DATABASE_URL to add SSL parameters
const dbUrl = new URL(process.env.DATABASE_URL);
// Add SSL mode to reject unauthorized certificates (needed for TimescaleDB)
const sslUrl = `${dbUrl.protocol}//${dbUrl.username}:${dbUrl.password}@${dbUrl.host}${dbUrl.pathname}?sslmode=require`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: sslUrl,
  },
});
