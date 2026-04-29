"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Send,
  AlertTriangle, ChevronRight, RefreshCw, Wallet, Lock, BarChart3, ArrowRight, X, Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetPacing {
  categoryId: number;
  category: string;
  color: string;
  tier: string;
  budget: number;
  spent: number;
  pct: number;
}

interface SIPStatus {
  name: string;
  amount: number;
  sipDate: number;
  executed: boolean;
  daysAway: number;
}

interface DashboardData {
  currentMonth: string;
  monthProgress: number;
  daysRemaining: number;
  budgetPacing: BudgetPacing[];
  totalBudget: number;
  totalSpent: number;
  savingsRate: number | null;
  fy: {
    label: string;
    progress: number;
    monthsElapsed: number;
    income: number;
    invested: number;
    savingsRate: number | null;
  };
  monthlyTotals: { month: string; total: number }[];
  sip: {
    total: number;
    nextSIP: SIPStatus | null;
    sipStatus: SIPStatus[];
    funds: { fundName: string; monthlyAmount: number; isFrozen: boolean }[];
  };
  subscriptions: { total: number; count: number };
  ltgs: { remaining: number; used: number; limit: number; financialYear: string } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

const TIER_ORDER = ["income", "fixed", "investment", "discretionary", "misc"] as const;

const TIER_META: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  income: {
    label: "Income",
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    description: "Money in",
  },
  fixed: {
    label: "Fixed Commitments",
    icon: <Lock className="h-3.5 w-3.5" />,
    description: "EMI, rent, utilities",
  },
  investment: {
    label: "Investments & Savings",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    description: "SIPs, savings",
  },
  discretionary: {
    label: "Discretionary",
    icon: <Wallet className="h-3.5 w-3.5" />,
    description: "Food, shopping, lifestyle",
  },
  misc: {
    label: "Misc.",
    icon: <Receipt className="h-3.5 w-3.5" />,
    description: "Annual & one-off expenses",
  },
};

// ─── Spend Overview (dual-ring donut + 6-month bars) ─────────────────────────

function DonutRings({
  segments, cx, cy, r, strokeWidth,
}: {
  segments: { pct: number; color: string }[];
  cx: number; cy: number; r: number; strokeWidth: number;
}) {
  const circ = 2 * Math.PI * r;
  const cumPcts = segments.map((_, i) => segments.slice(0, i).reduce((s, sg) => s + sg.pct, 0));
  const arcs = segments.map((seg, i) => ({
    dash: seg.pct * circ,
    gap: (1 - seg.pct) * circ,
    rot: cumPcts[i] * 360 - 90,
    color: seg.color,
  }));
  return (
    <>
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dash.toFixed(2)} ${arc.gap.toFixed(2)}`}
          transform={`rotate(${arc.rot}, ${cx}, ${cy})`}
        />
      ))}
    </>
  );
}

function SpendOverview({
  fixedBudget, fixedSpent,
  investBudget, investSpent,
  discBudget, discSpent,
  miscBudget, miscSpent,
  monthlyTotals,
  totalBudget,
}: {
  fixedBudget: number; fixedSpent: number;
  investBudget: number; investSpent: number;
  discBudget: number; discSpent: number;
  miscBudget: number; miscSpent: number;
  monthlyTotals: { month: string; total: number }[];
  totalBudget: number;
}) {
  const budgetTotal = fixedBudget + investBudget + discBudget + miscBudget;
  const spentTotal  = fixedSpent  + investSpent  + discSpent  + miscSpent;

  const outerSegs = budgetTotal > 0 ? [
    { pct: fixedBudget  / budgetTotal, color: "#4ade8055" },
    { pct: investBudget / budgetTotal, color: "#818cf855" },
    { pct: discBudget   / budgetTotal, color: "#e4b73a55" },
    { pct: miscBudget   / budgetTotal, color: "#94a3b855" },
  ] : [];

  const innerSegs = spentTotal > 0 ? [
    { pct: fixedSpent  / spentTotal, color: "#4ade80" },
    { pct: investSpent / spentTotal, color: "#818cf8" },
    { pct: discSpent   / spentTotal, color: "#e4b73a" },
    { pct: miscSpent   / spentTotal, color: "#94a3b8" },
  ] : [];

  // Last 6 months for bar chart (pad with nulls if fewer months)
  const last6 = Array.from({ length: 6 }, (_, i) => monthlyTotals[monthlyTotals.length - 6 + i] ?? null);
  const maxVal = Math.max(totalBudget * 1.2, ...last6.map(m => m?.total ?? 0));
  const BAR_H = 80;

  function fmtShort(n: number) {
    return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${Math.round(n / 1000)}K`;
  }

  const tiers = [
    { label: "Fixed",       color: "#4ade80", spent: fixedSpent,  budget: fixedBudget  },
    { label: "Investments", color: "#818cf8", spent: investSpent, budget: investBudget },
    { label: "Guilt-free",  color: "#e4b73a", spent: discSpent,   budget: discBudget   },
    { label: "Misc.",       color: "#94a3b8", spent: miscSpent,   budget: miscBudget   },
  ];

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Spend Overview</p>
          <p className="text-xs text-muted-foreground tabular-nums">{fmtShort(spentTotal)} of {fmtShort(budgetTotal)}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 items-center">

          {/* Left: dual-ring donut */}
          <div className="flex items-center gap-4">
            <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
              <DonutRings segments={outerSegs} cx={55} cy={55} r={44} strokeWidth={12} />
              <DonutRings segments={innerSegs} cx={55} cy={55} r={29} strokeWidth={12} />
              <text x="55" y="51" textAnchor="middle" fill="#e4e4e7" fontSize="12" fontWeight="700" fontFamily="inherit">
                {fmtShort(spentTotal)}
              </text>
              <text x="55" y="63" textAnchor="middle" fill="#71717a" fontSize="9" fontFamily="inherit">
                spent
              </text>
            </svg>

            <div className="space-y-2.5 flex-1">
              <p className="text-[10px] text-muted-foreground/60">outer = budget · inner = actual</p>
              {tiers.map(t => {
                const delta = t.budget > 0 ? Math.round((t.spent / t.budget - 1) * 100) : 0;
                const under = delta < 0;
                return (
                  <div key={t.label} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color }} />
                      <span className="text-xs">{t.label}</span>
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-xs text-muted-foreground">
                        {fmtShort(t.spent)}<span className="text-muted-foreground/40"> / {fmtShort(t.budget)}</span>
                      </span>
                      <span className={cn("text-[11px] font-medium w-8 text-right", under ? "text-muted-foreground/50" : "text-destructive")}>
                        {under ? `↓${Math.abs(delta)}%` : `↑${delta}%`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: 6-month bar chart */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-muted-foreground/60">6-month spend</p>
              <p className="text-[10px] text-muted-foreground/40">- - - budget {fmtShort(totalBudget)}</p>
            </div>
            <div className="relative">
              {/* Budget threshold line */}
              {totalBudget > 0 && (
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-border/60 pointer-events-none"
                  style={{ bottom: `${Math.round((totalBudget / maxVal) * BAR_H) + 16}px` }}
                />
              )}
              <div className="flex items-end gap-1.5" style={{ height: `${BAR_H + 16}px` }}>
                {last6.map((m, i) => {
                  if (!m) return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div className="w-full rounded-sm" style={{ height: 4, background: "#27272a" }} />
                      <span className="text-[9px] text-muted-foreground/30">—</span>
                    </div>
                  );
                  const h = Math.max(4, Math.round((m.total / maxVal) * BAR_H));
                  const over = m.total > totalBudget;
                  const isCurrent = i === 5;
                  const label = format(new Date(m.month + "-01"), "MMM");
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1">
                      <div
                        className="w-full rounded-sm transition-all"
                        style={{
                          height: h,
                          background: over ? "#ef4444" : isCurrent ? "#e4b73a" : "#e4b73a55",
                        }}
                      />
                      <span className={cn("text-[9px]", isCurrent ? "text-foreground/80" : "text-muted-foreground/50")}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}

function PacingBar({ pct, monthProgress }: { pct: number; monthProgress: number }) {
  const over = pct > 100;
  const warning = pct > monthProgress + 15 && pct <= 100;

  return (
    <div className="relative h-1.5 w-full rounded-full bg-border overflow-hidden">
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-border/60"
        style={{ width: `${monthProgress}%` }}
      />
      <div
        className={cn(
          "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
          over    ? "bg-destructive" :
          warning ? "bg-amber-400 dark:bg-amber-500" :
                    "bg-foreground"
        )}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

// ─── Anomaly Alert Strip ──────────────────────────────────────────────────────

interface Anomaly {
  categoryId: number;
  category: string;
  color: string;
  currentSpend: number;
  median: number;
  ratio: number;
}

function AnomalyStrip() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/anomalies")
      .then(r => r.json())
      .then((d: { anomalies: Anomaly[] }) => { setAnomalies(d.anomalies ?? []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const visible = anomalies.filter(a => !dismissed.has(a.categoryId));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(a => (
        <div key={a.categoryId} className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">{a.category}</span>
            <span className="text-xs text-muted-foreground ml-2">
              {fmt(a.currentSpend)} this month · {a.ratio}× usual ({fmt(a.median)} median)
            </span>
          </div>
          <button
            onClick={() => setDismissed(prev => new Set([...prev, a.categoryId]))}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Tier Section ─────────────────────────────────────────────────────────────

function TierSection({
  tier,
  items,
  monthProgress,
}: {
  tier: string;
  items: BudgetPacing[];
  monthProgress: number;
}) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const meta = TIER_META[tier] ?? { label: tier, icon: null, description: "" };
  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const overallPct = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const isOver = totalSpent > totalBudget;
  const isWarning = overallPct > monthProgress + 15 && !isOver;

  return (
    <div>
      {/* Tier header — click to expand/collapse */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between mb-2 group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-muted-foreground transition-transform duration-200",
            open ? "rotate-90" : "",
            isOver ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : ""
          )}>
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
          <span className={cn(
            "flex items-center gap-1.5",
            isOver ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          )}>
            {meta.icon}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2 tabular-nums text-xs text-muted-foreground">
          <span className={cn(isOver ? "text-destructive font-medium" : "")}>{fmt(totalSpent)}</span>
          <span className="text-border/60">of</span>
          <span>{fmt(totalBudget)}</span>
          <span className={cn(
            "w-8 text-right font-medium",
            isOver ? "text-destructive" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          )}>
            {overallPct}%
          </span>
        </div>
      </button>

      {/* Category rows — only shown when open */}
      {open && (
      <div className="rounded-xl border border-border overflow-hidden">
        {items.map((item, i) => (
          <div
            key={item.categoryId}
            className={cn(
              "px-3 py-2.5 space-y-1.5",
              i < items.length - 1 && "border-b border-border"
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-foreground">{item.category}</span>
              <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
                <span>{fmt(item.spent)}</span>
                <span className="text-border/60">·</span>
                <span>{fmt(item.budget)}</span>
                <span className={cn(
                  "w-8 text-right font-medium",
                  item.pct > 100 ? "text-destructive" :
                  item.pct > monthProgress + 15 ? "text-amber-600 dark:text-amber-400" :
                  "text-muted-foreground"
                )}>
                  {item.pct}%
                </span>
              </div>
            </div>
            <PacingBar pct={item.pct} monthProgress={monthProgress} />
          </div>
        ))}
      </div>
      )}
    </div>
  );
}

// ─── Scenario Planner ────────────────────────────────────────────────────────

function ScenarioPlanner() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "What if I spent ₹5K on an unplanned dinner?",
    "Can I afford a ₹20K flight next week?",
    "How does ₹8K on clothes affect my budget?",
  ];

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json() as { answer?: string; error?: string };
      setAnswer(data.answer ?? data.error ?? "Something went wrong");
    } catch {
      setAnswer("Could not connect to AI. Is Ollama running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          Scenario Planner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setQuestion(s); ask(s); }}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(question)}
            placeholder="Ask a what-if question…"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="shrink-0"
          >
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {answer && (
          <div className="rounded-lg bg-muted p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {answer}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d: DashboardData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!data) return <p className="text-muted-foreground text-sm">Failed to load data.</p>;

  // Group budget pacing by tier
  const byTier = TIER_ORDER.reduce<Record<string, BudgetPacing[]>>((acc, t) => {
    acc[t] = data.budgetPacing.filter(b => b.tier === t).sort((a, b) => b.pct - a.pct);
    return acc;
  }, {});

  // Derive summary figures from tier groups
  const incomeBudget = byTier.income.reduce((s, i) => s + i.budget, 0);

  const fixedTotal    = byTier.fixed.reduce((s, i) => s + i.budget, 0);
  const fixedSpent    = byTier.fixed.reduce((s, i) => s + i.spent, 0);

  const investTotal   = byTier.investment.reduce((s, i) => s + i.budget, 0);
  const investSpent   = byTier.investment.reduce((s, i) => s + i.spent, 0);

  const discTotal     = byTier.discretionary.reduce((s, i) => s + i.budget, 0);
  const discSpent     = byTier.discretionary.reduce((s, i) => s + i.spent, 0);

  const miscTotal     = (byTier.misc ?? []).reduce((s, i) => s + i.budget, 0);
  const miscSpent     = (byTier.misc ?? []).reduce((s, i) => s + i.spent, 0);

  const committedBudget = fixedTotal + investTotal;
  const committedSpent  = fixedSpent + investSpent;

  // Discretionary headroom = income budget − committed − discretionary budget
  const headroom = incomeBudget - committedBudget - discTotal;

  const overallPct = data.totalBudget > 0 ? Math.round((data.totalSpent / data.totalBudget) * 100) : 0;
  const onTrack = overallPct <= data.monthProgress + 5;

  return (
    <div className="space-y-6">

      {/* ── FY progress bar ── */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">FY {data.fy.label}</span>
                <span className="text-muted-foreground tabular-nums">
                  {data.fy.monthsElapsed} of 12 months · {data.fy.progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground/40 transition-all"
                  style={{ width: `${data.fy.progress}%` }}
                />
              </div>
            </div>
            {data.fy.savingsRate !== null && (
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">FY savings rate</p>
                <p className={cn(
                  "text-lg font-semibold tabular-nums",
                  data.fy.savingsRate >= 20 ? "text-emerald-600 dark:text-emerald-400" :
                  data.fy.savingsRate >= 10 ? "text-amber-600 dark:text-amber-400" :
                  "text-destructive"
                )}>
                  {data.fy.savingsRate}%
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Top summary row ── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Total spend + savings rate */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Spent this month</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(data.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              of {fmt(data.totalBudget)} total budget
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {onTrack
                ? <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                : overallPct > data.monthProgress + 15
                  ? <TrendingUp className="h-3.5 w-3.5 text-destructive" />
                  : <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              }
              <span className={cn(
                "text-xs tabular-nums",
                onTrack ? "text-emerald-600 dark:text-emerald-400" :
                overallPct > data.monthProgress + 15 ? "text-destructive" :
                "text-muted-foreground"
              )}>
                {overallPct}% used · {data.monthProgress}% of month
              </span>
            </div>
            {data.savingsRate !== null && (
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Savings rate</span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    data.savingsRate >= 20 ? "text-emerald-600 dark:text-emerald-400" :
                    data.savingsRate >= 10 ? "text-amber-600 dark:text-amber-400" :
                    "text-destructive"
                  )}>
                    {data.savingsRate}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fixed + Investments committed */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Committed</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(committedSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              of {fmt(committedBudget)} planned
            </p>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>Fixed</span><span>{fmt(fixedSpent)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                <span>Investments</span><span>{fmt(investSpent)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Discretionary headroom */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Discretionary</p>
            <p className={cn(
              "text-2xl font-semibold tabular-nums tracking-tight",
              discSpent > discTotal ? "text-destructive" : "text-foreground"
            )}>
              {fmt(discTotal - discSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {discSpent > discTotal ? "over budget" : `remaining of ${fmt(discTotal)}`}
            </p>
            {data.daysRemaining > 0 && discTotal > discSpent && (
              <p className="text-xs text-muted-foreground mt-3 tabular-nums">
                ~{fmt(Math.round((discTotal - discSpent) / data.daysRemaining))}/day
              </p>
            )}
            {headroom > 0 && (
              <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                {fmt(headroom)} unallocated
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Spend Overview ── */}
      <SpendOverview
        fixedBudget={fixedTotal}   fixedSpent={fixedSpent}
        investBudget={investTotal} investSpent={investSpent}
        discBudget={discTotal}     discSpent={discSpent}
        miscBudget={miscTotal}     miscSpent={miscSpent}
        monthlyTotals={data.monthlyTotals}
        totalBudget={data.totalBudget}
      />

      {/* ── Anomaly alerts ── */}
      <AnomalyStrip />

      {/* ── Month progress header ── */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">
          {format(new Date(), "MMMM yyyy")}
        </span>
        <Badge variant="outline" className="text-xs tabular-nums">
          Day {new Date().getDate()} of{" "}
          {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
        </Badge>
        <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/30"
            style={{ width: `${data.monthProgress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{data.monthProgress}%</span>
      </div>

      {/* ── 3-Tier budget pacing ── */}
      <div className="space-y-6">
        {TIER_ORDER.map(tier => (
          <TierSection
            key={tier}
            tier={tier}
            items={byTier[tier] ?? []}
            monthProgress={data.monthProgress}
          />
        ))}
      </div>

      {/* ── Bottom row: Scenario + Sidebar ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <ScenarioPlanner />
        </div>

        <div className="space-y-4">
          {/* LTGS card */}
          {data.ltgs && (
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-muted-foreground">LTGS Remaining</p>
                  {data.ltgs.remaining > 0 && (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                </div>
                <p className="text-xl font-semibold tabular-nums tracking-tight">
                  {fmt(data.ltgs.remaining)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {fmt(data.ltgs.limit)} exemption
                </p>
                <div className="mt-3 h-1.5 w-full rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${Math.round((data.ltgs.used / data.ltgs.limit) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {fmt(data.ltgs.used)} used · FY {data.ltgs.financialYear}
                </p>
              </CardContent>
            </Card>
          )}

          {/* SIP execution status */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monthly SIPs</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {fmt(data.sip.total)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              {data.sip.sipStatus.length > 0 && (
                <div className="space-y-1.5">
                  {data.sip.sipStatus.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          s.executed ? "bg-emerald-500" : "bg-amber-400"
                        )} />
                        <span className="text-muted-foreground truncate">{s.name.split(" ")[0]}</span>
                      </div>
                      <span className={cn(
                        "tabular-nums shrink-0 ml-2",
                        s.executed ? "text-muted-foreground" : "text-foreground"
                      )}>
                        {s.executed ? `✓ ${s.sipDate}th` : `${s.sipDate}th${s.daysAway === 0 ? " (today)" : ` (${s.daysAway}d)`}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Subscriptions */}
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground mb-1">Subscriptions</p>
              <p className="text-xl font-semibold tabular-nums">
                {fmt(data.subscriptions.total)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.subscriptions.count} active
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-1.5 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
