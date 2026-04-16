import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, categories, investments, vault, categoryMappings } from "@/db/schema";
import { count } from "drizzle-orm";
import { checkOllamaHealth } from "@/lib/ollama";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export async function GET() {
  try {
    const [txCount, catCount, invCount, vaultCount, mappingCount, ollamaStatus] = await Promise.all([
      db.select({ count: count() }).from(transactions),
      db.select({ count: count() }).from(categories),
      db.select({ count: count() }).from(investments),
      db.select({ count: count() }).from(vault),
      db.select({ count: count() }).from(categoryMappings),
      checkOllamaHealth(),
    ]);

    const dbPath = path.resolve(process.cwd(), "finance.db");
    const dbStats = fs.existsSync(dbPath) ? fs.statSync(dbPath) : null;
    const backupDest = process.env.BACKUP_DEST ?? "";
    const backupExists = backupDest && fs.existsSync(backupDest);
    let lastBackup: string | null = null;
    if (backupExists) {
      const files = fs.readdirSync(backupDest).filter(f => f.startsWith("finance_") && f.endsWith(".db")).sort();
      lastBackup = files[files.length - 1] ?? null;
    }

    return NextResponse.json({
      db: {
        path: dbPath,
        sizeMb: dbStats ? (dbStats.size / (1024 * 1024)).toFixed(2) : null,
        counts: {
          transactions: txCount[0].count,
          categories: catCount[0].count,
          investments: invCount[0].count,
          vaultEntries: vaultCount[0].count,
          learnedMappings: mappingCount[0].count,
        },
      },
      ollama: ollamaStatus,
      backup: {
        dest: backupDest,
        ssdMounted: !!backupExists,
        lastBackup,
      },
    });
  } catch (err) {
    console.error("[admin GET]", err);
    return NextResponse.json({ error: "Failed to load admin data" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json() as { action: string };
    if (action === "backup") {
      execSync("npx tsx scripts/backup.ts", { cwd: process.cwd() });
      return NextResponse.json({ ok: true, message: "Backup complete" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
