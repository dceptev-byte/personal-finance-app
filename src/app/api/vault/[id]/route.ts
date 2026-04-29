import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vault } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/crypto";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [row] = await db.select().from(vault).where(eq(vault.id, Number(id)));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const decrypted = decrypt<{ fields: { key: string; value: string }[]; notes?: string }>({
      encryptedData: row.encryptedData, iv: row.iv, authTag: row.authTag,
    });
    return NextResponse.json({ ...decrypted, title: row.title, category: row.category, reminderDate: row.reminderDate, reminderNote: row.reminderNote });
  } catch (err) {
    console.error("[vault/:id GET]", err);
    return NextResponse.json({ error: "Failed to decrypt" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(vault).where(eq(vault.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
