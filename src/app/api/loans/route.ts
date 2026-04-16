import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans, amortisationSchedule } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(loans).orderBy(loans.name);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string; keyword: string; originalAmount?: number;
    startDate?: string; principalCategoryId?: number;
    interestCategoryId?: number; notes?: string;
  };
  const [loan] = await db.insert(loans).values(body).returning();
  return NextResponse.json(loan);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json() as { id: number };
  await db.delete(amortisationSchedule).where(eq(amortisationSchedule.loanId, id));
  await db.delete(loans).where(eq(loans.id, id));
  return NextResponse.json({ ok: true });
}
