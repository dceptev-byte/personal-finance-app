import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { vault } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";

interface VaultField { key: string; value: string }
interface VaultPayload { fields: VaultField[]; notes?: string }

export async function GET() {
  try {
    const rows = await db.select().from(vault).orderBy(vault.category, vault.title);
    // Return only metadata (not decrypted) for the list view
    return NextResponse.json(rows.map(r => ({
      id: r.id, title: r.title, category: r.category,
      reminderDate: r.reminderDate, reminderNote: r.reminderNote,
      createdAt: r.createdAt, updatedAt: r.updatedAt,
    })));
  } catch (err) {
    console.error("[vault GET]", err);
    return NextResponse.json({ error: "Failed to fetch vault" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { title: string; category: string; fields: VaultField[]; notes?: string; reminderDate?: string; reminderNote?: string };
    const payload: VaultPayload = { fields: body.fields, notes: body.notes };
    const { encryptedData, iv, authTag } = encrypt(payload);
    const [row] = await db.insert(vault).values({
      title: body.title, category: body.category,
      encryptedData, iv, authTag,
      reminderDate: body.reminderDate ?? null,
      reminderNote: body.reminderNote ?? null,
    }).returning();
    return NextResponse.json({ id: row.id, title: row.title, category: row.category }, { status: 201 });
  } catch (err) {
    console.error("[vault POST]", err);
    return NextResponse.json({ error: "Failed to create vault entry" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; fields: VaultField[]; notes?: string; reminderDate?: string; reminderNote?: string };
    const [row] = await db.select().from(vault).where(eq(vault.id, body.id));
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const payload: VaultPayload = { fields: body.fields, notes: body.notes };
    const { encryptedData, iv, authTag } = encrypt(payload);
    await db.update(vault).set({ encryptedData, iv, authTag, reminderDate: body.reminderDate ?? null, reminderNote: body.reminderNote ?? null, updatedAt: new Date().toISOString() }).where(eq(vault.id, body.id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vault PUT]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
