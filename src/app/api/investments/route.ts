import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { investments } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db.select().from(investments).orderBy(investments.type);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[investments GET]", err);
    return NextResponse.json({ error: "Failed to fetch investments" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; fundName?: string; type?: string; monthlyAmount?: number; sipDate?: number; stepUpPercent?: number; stepUpMode?: string; platform?: string; currentValue?: number; isFrozen?: boolean; notes?: string };
    const [updated] = await db
      .update(investments)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(investments.id, body.id))
      .returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[investments PATCH]", err);
    return NextResponse.json({ error: "Failed to update investment" }, { status: 500 });
  }
}
