import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { splitRules, splitRuleItems } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const rules = await db.select().from(splitRules).orderBy(splitRules.name);
  const items = await db.select().from(splitRuleItems).orderBy(splitRuleItems.sortOrder);
  return NextResponse.json(rules.map(r => ({ ...r, items: items.filter(i => i.ruleId === r.id) })));
}

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    name: string; keyword: string;
    items: { categoryId: number | null; fixedAmount: number | null; label: string }[];
  };
  const [rule] = await db.insert(splitRules).values({ name: body.name, keyword: body.keyword }).returning();
  const insertedItems = [];
  for (let i = 0; i < body.items.length; i++) {
    const [item] = await db.insert(splitRuleItems).values({ ruleId: rule.id, sortOrder: i, ...body.items[i] }).returning();
    insertedItems.push(item);
  }
  return NextResponse.json({ ...rule, items: insertedItems });
}
