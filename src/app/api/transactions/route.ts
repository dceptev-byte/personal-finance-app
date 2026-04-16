import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");

    const rows = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        description: transactions.description,
        amount: transactions.amount,
        month: transactions.month,
        source: transactions.source,
        notes: transactions.notes,
        isVerified: transactions.isVerified,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        isSplit: transactions.isSplit,
        parentId: transactions.parentId,
        splitLabel: transactions.splitLabel,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.month, month))
      .orderBy(desc(transactions.date));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[transactions GET]", err);
    return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      date: string;
      description: string;
      amount: number;
      categoryId?: number;
      notes?: string;
    };

    const month = body.date.slice(0, 7); // "2026-04"
    const [row] = await db
      .insert(transactions)
      .values({
        date: body.date,
        description: body.description,
        amount: body.amount,
        categoryId: body.categoryId ?? null,
        month,
        source: "manual",
        notes: body.notes ?? null,
        isVerified: true,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error("[transactions POST]", err);
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }
}
