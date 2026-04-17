import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, categoryMappings } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { extractKeyword, isKeywordUseful } from "@/lib/keywords";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json() as {
      categoryId?: number | null;
      description?: string;
      amount?: number;
      notes?: string;
      isVerified?: boolean;
    };

    const [updated] = await db
      .update(transactions)
      .set({ ...body, updatedAt: new Date().toISOString() })
      .where(eq(transactions.id, Number(id)))
      .returning();

    // Auto-learn: when a categoryId is explicitly set on verify, save the mapping
    if (body.categoryId && body.isVerified) {
      const keyword = extractKeyword(updated.description);
      if (isKeywordUseful(keyword)) {
        // Upsert: insert or increment hitCount if it already exists
        await db
          .insert(categoryMappings)
          .values({
            keyword,
            categoryId: body.categoryId,
            hitCount: 1,
          })
          .onConflictDoUpdate({
            target: categoryMappings.keyword,
            set: {
              categoryId: body.categoryId,
              hitCount: sql`hit_count + 1`,
              updatedAt: new Date().toISOString(),
            },
          });
      }
    }

    // Auto-approve parent when all its children are now verified
    if (body.isVerified && updated.parentId) {
      const siblings = await db.select({ isVerified: transactions.isVerified })
        .from(transactions)
        .where(eq(transactions.parentId, updated.parentId));
      const allVerified = siblings.length > 0 && siblings.every(s => s.isVerified);
      if (allVerified) {
        await db.update(transactions)
          .set({ isVerified: true, updatedAt: new Date().toISOString() })
          .where(eq(transactions.id, updated.parentId));
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[transactions PATCH]", err);
    return NextResponse.json({ error: "Failed to update transaction" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(transactions).where(eq(transactions.id, Number(id)));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[transactions DELETE]", err);
    return NextResponse.json({ error: "Failed to delete transaction" }, { status: 500 });
  }
}
