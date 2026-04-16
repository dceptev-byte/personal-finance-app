import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "finance.db");
const MIGRATIONS_PATH = path.resolve(process.cwd(), "src/db/migrations");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite);

console.log("Running migrations...");
migrate(db, { migrationsFolder: MIGRATIONS_PATH });
console.log("Migrations complete ✓");

sqlite.close();
