import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { transactions, imports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { format } from "date-fns";

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") ?? format(new Date(), "yyyy-MM");

    await db.delete(transactions).where(eq(transactions.month, month));
    await db.delete(imports).where(eq(imports.month, month));

    return NextResponse.json({ ok: true, month });
  } catch (err) {
    console.error("[transactions/clear DELETE]", err);
    return NextResponse.json({ error: "Failed to clear transactions" }, { status: 500 });
  }
}
