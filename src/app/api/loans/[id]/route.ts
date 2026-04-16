import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { loans } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as Partial<typeof loans.$inferInsert>;
  const [updated] = await db.update(loans)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(loans.id, Number(id))).returning();
  return NextResponse.json(updated);
}
