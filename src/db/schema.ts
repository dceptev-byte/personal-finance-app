import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────
// EXPENSE CATEGORIES
// ─────────────────────────────────────────────
export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),        // e.g. "Household", "Transport"
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon"),
  // Tier controls dashboard grouping: "fixed" | "investment" | "income" | "discretionary" | "misc"
  tier: text("tier").notNull().default("discretionary"),
  excludeFromBudget: integer("exclude_from_budget", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// MONTHLY BUDGETS (budget targets per category per month)
// ─────────────────────────────────────────────
export const budgets = sqliteTable("budgets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  month: text("month").notNull(),               // "2026-04" format
  amount: real("amount").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// TRANSACTIONS (actual expenses)
// ─────────────────────────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),                 // "2026-04-12"
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  month: text("month").notNull(),               // "2026-04" — derived but stored for fast queries
  source: text("source").notNull().default("manual"), // "manual" | "import"
  importId: integer("import_id").references(() => imports.id),
  notes: text("notes"),
  isVerified: integer("is_verified", { mode: "boolean" }).default(false),
  isSplit: integer("is_split", { mode: "boolean" }).default(false),   // parent has been split into children
  parentId: integer("parent_id"),                                      // child: references parent transaction id
  splitLabel: text("split_label"),                                     // child: "Principal", "Interest", "Parents", etc.
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// STATEMENT IMPORTS (track what's been imported)
// ─────────────────────────────────────────────
export const imports = sqliteTable("imports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  filename: text("filename").notNull(),
  importedAt: text("imported_at").default(sql`(datetime('now'))`),
  rowCount: integer("row_count").default(0),
  source: text("source"),                        // "HDFC", "Axis", "ICICI", etc.
  status: text("status").notNull().default("pending"), // "pending" | "complete" | "error"
});

// ─────────────────────────────────────────────
// ONE-OFF ANNUAL EXPENSES (FRRO, Flight, Property Tax, CA)
// ─────────────────────────────────────────────
export const annualExpenses = sqliteTable("annual_expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                 // "FRRO", "Flight", "Prop. Tax", "CA"
  year: integer("year").notNull(),
  budgetedAmount: real("budgeted_amount").notNull().default(0),
  actualAmount: real("actual_amount").default(0),
  dueMonth: text("due_month"),                  // "2026-04" — expected month
  categoryId: integer("category_id").references(() => categories.id), // budget category to auto-populate
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// SUBSCRIPTIONS
// ─────────────────────────────────────────────
export const subscriptions = sqliteTable("subscriptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                 // "Netflix", "Claude", "YT", "PSN"
  monthlyAmount: real("monthly_amount").notNull().default(0),
  yearlyAmount: real("yearly_amount").notNull().default(0),
  billingCycle: text("billing_cycle").notNull().default("monthly"), // "monthly" | "yearly"
  nextDueDate: text("next_due_date"),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// INVESTMENTS / SIPs
// ─────────────────────────────────────────────
export const investments = sqliteTable("investments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),                 // "Index" | "Active" | "Retirement" | "Legacy"
  fundName: text("fund_name").notNull(),         // "HDFC Nifty 100", "Parag Flexi"
  categoryId: integer("category_id").references(() => categories.id), // which budget category this SIP belongs to
  monthlyAmount: real("monthly_amount").notNull().default(0),
  stepUpPercent: real("step_up_percent").default(10),
  stepUpMode: text("step_up_mode").default("manual"), // "manual" | "auto"
  sipDate: integer("sip_date"),                  // day of month: 1, 15, 27
  platform: text("platform"),                    // "Kuvera", "Scripbox"
  isFrozen: integer("is_frozen", { mode: "boolean" }).default(false),
  currentValue: real("current_value"),           // manually updated portfolio value
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// TAX DEDUCTIONS
// ─────────────────────────────────────────────
export const taxDeductions = sqliteTable("tax_deductions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  financialYear: text("financial_year").notNull(), // "2026-27"
  section: text("section").notNull(),              // "80C", "Section 24", "80D", "80CCD(1B)"
  description: text("description").notNull(),
  limit: real("limit").notNull().default(0),
  used: real("used").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// LTGS TRACKER
// ─────────────────────────────────────────────
export const ltgsTracker = sqliteTable("ltgs_tracker", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  financialYear: text("financial_year").notNull(), // "2026-27"
  exemptionLimit: real("exemption_limit").notNull().default(100000),
  used: real("used").notNull().default(0),
  notes: text("notes"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// VAULT (encrypted sensitive notes — replaces Notes tab)
// ─────────────────────────────────────────────
export const vault = sqliteTable("vault", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),               // "HDFC ERGO", "Axis Bank"
  category: text("category").notNull().default("general"), // "insurance" | "bank" | "investment" | "general"
  // All fields below are AES-256-GCM encrypted blobs stored as hex strings
  encryptedData: text("encrypted_data").notNull(), // JSON blob: { fields: [{key, value}], notes }
  iv: text("iv").notNull(),                      // 16-byte IV as hex
  authTag: text("auth_tag").notNull(),           // 16-byte auth tag as hex
  reminderDate: text("reminder_date"),           // for nominee update reminders etc.
  reminderNote: text("reminder_note"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// LOANS + AMORTISATION SCHEDULE
// ─────────────────────────────────────────────
export const loans = sqliteTable("loans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                    // "LIC Housing Finance"
  keyword: text("keyword").notNull(),              // "lichousingfinance" — matched against extracted keyword
  originalAmount: real("original_amount"),
  startDate: text("start_date"),                   // "2023-04"
  principalCategoryId: integer("principal_category_id").references(() => categories.id),
  interestCategoryId: integer("interest_category_id").references(() => categories.id),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

export const amortisationSchedule = sqliteTable("amortisation_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  loanId: integer("loan_id").notNull().references(() => loans.id),
  month: text("month").notNull(),                  // "2026-04"
  emi: real("emi").notNull().default(0),
  principal: real("principal").notNull().default(0),
  interest: real("interest").notNull().default(0),
  balance: real("balance"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// FIXED SPLIT RULES (e.g. transfer → Parents + Savings/ER + remainder)
// ─────────────────────────────────────────────
export const splitRules = sqliteTable("split_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                    // "Parents transfer"
  keyword: text("keyword").notNull(),              // "accammageorgeeapen"
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const splitRuleItems = sqliteTable("split_rule_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ruleId: integer("rule_id").notNull().references(() => splitRules.id),
  categoryId: integer("category_id").references(() => categories.id),
  fixedAmount: real("fixed_amount"),               // null = remainder goes here
  label: text("label"),                            // display label for this split
  sortOrder: integer("sort_order").default(0),
});

// ─────────────────────────────────────────────
// SAVINGS (Fixed Deposits, RDs, PPF, etc.)
// ─────────────────────────────────────────────
export const savings = sqliteTable("savings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),              // "SIB Fixed Deposit"
  institution: text("institution"),          // "SIB", "HDFC"
  type: text("type").notNull().default("fd"), // "fd" | "rd" | "ppf" | "nps" | "savings"
  monthlyAmount: real("monthly_amount").notNull().default(0),
  interestRate: real("interest_rate"),       // annual % e.g. 6.0
  tenureMonths: integer("tenure_months"),    // e.g. 6
  categoryId: integer("category_id").references(() => categories.id),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  notes: text("notes"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// NET WORTH — ASSETS
// ─────────────────────────────────────────────
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                  // "HDFC Savings", "Flat - Kochi", "Kuvera Portfolio"
  type: text("type").notNull(),                  // "bank" | "property" | "investment" | "epf" | "other"
  currentValue: real("current_value").notNull().default(0),
  notes: text("notes"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// Monthly snapshot for net worth history
export const netWorthSnapshots = sqliteTable("net_worth_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull(),                // "2026-04"
  totalAssets: real("total_assets").notNull().default(0),
  totalLiabilities: real("total_liabilities").notNull().default(0),
  netWorth: real("net_worth").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// CATEGORY MAPPINGS (learned from user verifications)
// ─────────────────────────────────────────────
export const categoryMappings = sqliteTable("category_mappings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull().unique(),       // normalised keyword, e.g. "swiggy", "david s"
  categoryId: integer("category_id").notNull().references(() => categories.id),
  hitCount: integer("hit_count").notNull().default(1), // how many times this mapping was applied
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// AI CHAT HISTORY
// ─────────────────────────────────────────────
export const aiChats = sqliteTable("ai_chats", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  role: text("role").notNull(),                 // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

// ─────────────────────────────────────────────
// TYPES (inferred from schema)
// ─────────────────────────────────────────────
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Import = typeof imports.$inferSelect;
export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;
export type TaxDeduction = typeof taxDeductions.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type VaultEntry = typeof vault.$inferSelect;
export type NewVaultEntry = typeof vault.$inferInsert;
export type CategoryMapping = typeof categoryMappings.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type AmortisationRow = typeof amortisationSchedule.$inferSelect;
export type SplitRule = typeof splitRules.$inferSelect;
export type SplitRuleItem = typeof splitRuleItems.$inferSelect;
export type Saving = typeof savings.$inferSelect;
export type NewSaving = typeof savings.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type NetWorthSnapshot = typeof netWorthSnapshots.$inferSelect;
