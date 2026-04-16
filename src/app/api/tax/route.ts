import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { taxDeductions, ltgsTracker } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const deductions = await db.select().from(taxDeductions).orderBy(taxDeductions.section);
    const ltgs = await db.select().from(ltgsTracker);
    return NextResponse.json({ deductions, ltgs: ltgs[0] ?? null });
  } catch (err) {
    console.error("[tax GET]", err);
    return NextResponse.json({ error: "Failed to fetch tax data" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as { id: number; used: number; table: "deductions" | "ltgs" };
    if (body.table === "ltgs") {
      const [updated] = await db.update(ltgsTracker)
        .set({ used: body.used, updatedAt: new Date().toISOString() })
        .where(eq(ltgsTracker.id, body.id)).returning();
      return NextResponse.json(updated);
    }
    const [updated] = await db.update(taxDeductions)
      .set({ used: body.used, updatedAt: new Date().toISOString() })
      .where(eq(taxDeductions.id, body.id)).returning();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[tax PATCH]", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
