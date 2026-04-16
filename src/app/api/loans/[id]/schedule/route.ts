import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { amortisationSchedule } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = await db.select().from(amortisationSchedule)
    .where(eq(amortisationSchedule.loanId, Number(id)))
    .orderBy(amortisationSchedule.month);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as { month: string; emi: number; principal: number; interest: number; balance?: number };

    // Check if a row for this month already exists — if so, update it instead
    const existing = await db.select().from(amortisationSchedule)
      .where(and(eq(amortisationSchedule.loanId, Number(id)), eq(amortisationSchedule.month, body.month)));

    if (existing.length > 0) {
      const [updated] = await db.update(amortisationSchedule)
        .set({ emi: body.emi, principal: body.principal, interest: body.interest, balance: body.balance ?? null, updatedAt: new Date().toISOString() })
        .where(and(eq(amortisationSchedule.loanId, Number(id)), eq(amortisationSchedule.month, body.month)))
        .returning();
      return NextResponse.json(updated);
    }

    const [row] = await db.insert(amortisationSchedule)
      .values({ loanId: Number(id), ...body })
      .returning();
    return NextResponse.json(row);
  } catch (err) {
    console.error("[schedule POST]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as { month: string; emi?: number; principal?: number; interest?: number; balance?: number };
  const [updated] = await db.update(amortisationSchedule)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(and(eq(amortisationSchedule.loanId, Number(id)), eq(amortisationSchedule.month, body.month)))
    .returning();
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { month } = await req.json() as { month: string };
  await db.delete(amortisationSchedule)
    .where(and(eq(amortisationSchedule.loanId, Number(id)), eq(amortisationSchedule.month, month)));
  return NextResponse.json({ ok: true });
}
