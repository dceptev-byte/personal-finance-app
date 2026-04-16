/**
 * Backup script — copies finance.db to your external SSD.
 * Run manually: npm run backup
 * Or set up a cron: 0 9 * * * cd /path/to/app && npm run backup
 */
import fs from "fs";
import path from "path";

// Load .env.local manually since this runs outside Next.js
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const DB_PATH = path.resolve(process.cwd(), "finance.db");
const BACKUP_DEST = process.env.BACKUP_DEST ?? "/Volumes/SSD/finance-backups";

function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .slice(0, 19);
}

function formatBytes(bytes: number): string {
  return bytes > 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(1)} KB`;
}

async function backup() {
  // Check source DB exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found at ${DB_PATH}`);
    process.exit(1);
  }

  // Check SSD is mounted
  if (!fs.existsSync(BACKUP_DEST)) {
    try {
      fs.mkdirSync(BACKUP_DEST, { recursive: true });
    } catch {
      console.error(`❌ Backup destination not accessible: ${BACKUP_DEST}`);
      console.error(`   Is your external SSD mounted?`);
      process.exit(1);
    }
  }

  const timestamp = getTimestamp();
  const backupFilename = `finance_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DEST, backupFilename);

  // Copy DB file
  fs.copyFileSync(DB_PATH, backupPath);

  const stats = fs.statSync(backupPath);
  console.log(`✅ Backup complete`);
  console.log(`   File: ${backupFilename}`);
  console.log(`   Size: ${formatBytes(stats.size)}`);
  console.log(`   Dest: ${BACKUP_DEST}`);

  // Prune: keep only the last 30 backups
  const allBackups = fs
    .readdirSync(BACKUP_DEST)
    .filter((f) => f.startsWith("finance_") && f.endsWith(".db"))
    .sort();

  if (allBackups.length > 30) {
    const toDelete = allBackups.slice(0, allBackups.length - 30);
    for (const file of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DEST, file));
    }
    console.log(`   Pruned ${toDelete.length} old backup(s) (keeping last 30)`);
  }
}

backup().catch((e) => {
  console.error("Backup failed:", e);
  process.exit(1);
});
