import { NextResponse } from "next/server";
import { db } from "@/db";
import { categories } from "@/db/schema";

export async function GET() {
  try {
    const rows = await db.select().from(categories).orderBy(categories.name);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("[categories GET]", err);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}
