import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { savings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const all = await db.select().from(savings).orderBy(savings.type, savings.name);
    return NextResponse.json(all);
  } catch (err) {
    console.error("[savings GET]", err);
    return NextResponse.json({ error: "Failed to fetch savings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string; institution?: string; type: string;
      monthlyAmount: number; interestRate?: number; tenureMonths?: number;
      categoryId?: number | null; notes?: string;
    };
    const [created] = await db.insert(savings).values(body).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("[savings POST]", err);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number } & Record<string, unknown>;
    const { id, ...updates } = body;
    const [updated] = await db.update(savings)
      .set({ ...updates, updatedAt: new Date().toISOString() })
      .where(eq(savings.id, id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[savings PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.delete(savings).where(eq(savings.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[savings DELETE]", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
