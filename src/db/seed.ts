/**
 * Seed the database with initial data from the Budget Pacing Google Sheet.
 * Run once: npx tsx src/db/seed.ts
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  categories,
  budgets,
  investments,
  subscriptions,
  annualExpenses,
  taxDeductions,
  ltgsTracker,
} from "./schema";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "finance.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

async function seed() {
  console.log("🌱 Seeding database...\n");

  // ── Categories (from Exp sheet columns) ─────────────────────────────────
  const categoryData = [
    { name: "Household",     color: "#6366f1", icon: "home" },
    { name: "Transport",     color: "#f59e0b", icon: "car" },
    { name: "Lifestyle",     color: "#ec4899", icon: "sparkles" },
    { name: "Subscriptions", color: "#8b5cf6", icon: "credit-card" },
    { name: "Phoebe",        color: "#f97316", icon: "heart" },
    { name: "Data",          color: "#06b6d4", icon: "wifi" },
    { name: "Parents",       color: "#84cc16", icon: "users" },
    { name: "Utility",       color: "#14b8a6", icon: "zap" },
    { name: "Health",        color: "#ef4444", icon: "activity" },
    { name: "Term",          color: "#64748b", icon: "shield" },
    { name: "NPS",           color: "#a855f7", icon: "trending-up" },
    { name: "EMI Interest",  color: "#dc2626", icon: "percent" },
    { name: "EMI Principal", color: "#16a34a", icon: "building" },
  ];

  const insertedCategories = await db
    .insert(categories)
    .values(categoryData)
    .onConflictDoNothing()
    .returning();

  console.log(`✓ ${insertedCategories.length} categories inserted`);

  // Build a name → id map
  const catMap: Record<string, number> = {};
  for (const cat of insertedCategories) {
    catMap[cat.name] = cat.id;
  }

  // ── Monthly Budgets (Row 3 of Exp sheet) ────────────────────────────────
  // Budget targets per category — applying to all months in FY 2026
  const months = [
    "2026-02","2026-03","2026-04","2026-05","2026-06",
    "2026-07","2026-08","2026-09","2026-10","2026-11","2026-12",
  ];

  const budgetAmounts: Record<string, number> = {
    "Household":     15000,
    "Transport":      1500,
    "Lifestyle":      5000,
    "Subscriptions":  3365,
    "Phoebe":         1500,
    "Data":           1615,
    "Parents":       15000,
    "Utility":        4000,
    "Health":            0,
    "Term":           8089,
    "NPS":            5000,
    "EMI Interest":      0,  // tracked but not a budget target
    "EMI Principal":     0,
  };

  const budgetRows = months.flatMap((month) =>
    Object.entries(budgetAmounts).map(([catName, amount]) => ({
      categoryId: catMap[catName],
      month,
      amount,
    }))
  );

  await db.insert(budgets).values(budgetRows).onConflictDoNothing();
  console.log(`✓ ${budgetRows.length} budget entries inserted`);

  // ── Investments / SIPs ──────────────────────────────────────────────────
  const investmentData = [
    {
      type: "Index",
      fundName: "HDFC Nifty 100",
      monthlyAmount: 15000,
      stepUpPercent: 10,
      stepUpMode: "manual",
      sipDate: 27,
      platform: "Kuvera",
      isFrozen: false,
    },
    {
      type: "Active",
      fundName: "Parag Flexi",
      monthlyAmount: 5000,
      stepUpPercent: 10,
      stepUpMode: "auto",
      sipDate: 1,
      platform: "Kuvera",
      isFrozen: false,
    },
    {
      type: "Retirement",
      fundName: "HDFC (70, 20, 10)",
      monthlyAmount: 5000,
      stepUpPercent: 10,
      stepUpMode: "manual",
      sipDate: 15,
      platform: "Kuvera",
      isFrozen: false,
    },
    {
      type: "Legacy",
      fundName: "ELSS (DSP, Axis, Mirae, SBI)",
      monthlyAmount: 0,
      stepUpPercent: 0,
      stepUpMode: "manual",
      sipDate: null,
      platform: "Scripbox",
      isFrozen: true,
    },
  ];

  await db.insert(investments).values(investmentData).onConflictDoNothing();
  console.log(`✓ ${investmentData.length} investments inserted`);

  // ── Subscriptions ───────────────────────────────────────────────────────
  const subscriptionData = [
    { name: "Netflix", monthlyAmount: 649,  yearlyAmount: 0,    billingCycle: "monthly" },
    { name: "PSN",     monthlyAmount: 0,    yearlyAmount: 3949, billingCycle: "yearly"  },
    { name: "YouTube", monthlyAmount: 149,  yearlyAmount: 0,    billingCycle: "monthly" },
    { name: "Claude",  monthlyAmount: 2236, yearlyAmount: 0,    billingCycle: "monthly" },
  ];

  await db.insert(subscriptions).values(subscriptionData).onConflictDoNothing();
  console.log(`✓ ${subscriptionData.length} subscriptions inserted`);

  // ── Annual Expenses ─────────────────────────────────────────────────────
  const annualData = [
    { name: "FRRO",          year: 2026, budgetedAmount: 10680, actualAmount: 0 },
    { name: "Flight",        year: 2026, budgetedAmount: 20000, actualAmount: 0 },
    { name: "Property Tax",  year: 2026, budgetedAmount: 6000,  actualAmount: 0 },
    { name: "CA Fees",       year: 2026, budgetedAmount: 2000,  actualAmount: 0 },
  ];

  await db.insert(annualExpenses).values(annualData).onConflictDoNothing();
  console.log(`✓ ${annualData.length} annual expenses inserted`);

  // ── Tax Deductions (FY 2026-27) ─────────────────────────────────────────
  const taxData = [
    { financialYear: "2026-27", section: "Standard Deduction", description: "Standard deduction for salaried",            limit: 52500,  used: 52500  },
    { financialYear: "2026-27", section: "80C",                description: "Home Loan Principal",                        limit: 150000, used: 150000 },
    { financialYear: "2026-27", section: "80CCD(1B)",          description: "NPS contribution (additional)",              limit: 50000,  used: 50000  },
    { financialYear: "2026-27", section: "Section 24",         description: "Home Loan Interest",                        limit: 200000, used: 200000 },
    { financialYear: "2026-27", section: "80D",                description: "Health Insurance (Howden Group Health)",     limit: 25000,  used: 22105  },
  ];

  await db.insert(taxDeductions).values(taxData).onConflictDoNothing();
  console.log(`✓ ${taxData.length} tax deductions inserted`);

  // ── LTGS Tracker ────────────────────────────────────────────────────────
  await db.insert(ltgsTracker).values([
    {
      financialYear: "2026-27",
      exemptionLimit: 100000,
      used: 35000,
      notes: "Harvest up to ₹1L at the right time. Repeat annually. (Scripbox)",
    },
  ]).onConflictDoNothing();
  console.log(`✓ LTGS tracker seeded`);

  console.log("\n✅ Seed complete!");
  sqlite.close();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
