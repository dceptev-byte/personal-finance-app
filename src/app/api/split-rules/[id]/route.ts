import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { splitRules, splitRuleItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(splitRuleItems).where(eq(splitRuleItems.ruleId, Number(id)));
  await db.delete(splitRules).where(eq(splitRules.id, Number(id)));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json() as {
    name?: string; keyword?: string; isActive?: boolean;
    items?: { categoryId: number | null; fixedAmount: number | null; label: string }[];
  };
  const [updated] = await db.update(splitRules)
    .set({ name: body.name, keyword: body.keyword, isActive: body.isActive })
    .where(eq(splitRules.id, Number(id))).returning();

  if (body.items) {
    await db.delete(splitRuleItems).where(eq(splitRuleItems.ruleId, Number(id)));
    for (let i = 0; i < body.items.length; i++) {
      await db.insert(splitRuleItems).values({ ruleId: Number(id), sortOrder: i, ...body.items[i] });
    }
  }
  return NextResponse.json(updated);
}
