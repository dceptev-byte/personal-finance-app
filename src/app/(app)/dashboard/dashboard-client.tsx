"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, Send,
  AlertTriangle, ChevronRight, RefreshCw,
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
  budget: number;
  spent: number;
  pct: number;
}

interface DashboardData {
  currentMonth: string;
  monthProgress: number;
  daysRemaining: number;
  budgetPacing: BudgetPacing[];
  totalBudget: number;
  totalSpent: number;
  monthlyTotals: { month: string; total: number }[];
  sip: {
    total: number;
    nextSIP: { name: string; amount: number; sipDate: number; daysAway: number } | null;
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

function PacingBar({ pct, monthProgress }: { pct: number; monthProgress: number }) {
  const over = pct > 100;
  const warning = pct > monthProgress + 15 && pct <= 100;
  const good = pct <= monthProgress + 5;

  return (
    <div className="relative h-1.5 w-full rounded-full bg-border overflow-hidden">
      {/* Month progress ghost */}
      <div
        className="absolute top-0 left-0 h-full rounded-full bg-border/60"
        style={{ width: `${monthProgress}%` }}
      />
      {/* Actual spend */}
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
        {/* Suggestion chips */}
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

        {/* Input */}
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
            {loading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Answer */}
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

  const remaining = data.totalBudget - data.totalSpent;
  const overallPct = Math.round((data.totalSpent / data.totalBudget) * 100);
  const onTrack = overallPct <= data.monthProgress + 5;

  return (
    <div className="space-y-6">
      {/* ── Top summary row ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Total spend */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Spent this month</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(data.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              of {fmt(data.totalBudget)} budget
            </p>
            <div className="mt-3 flex items-center gap-1.5">
              {onTrack ? (
                <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
              ) : overallPct > data.monthProgress + 15 ? (
                <TrendingUp className="h-3.5 w-3.5 text-destructive" />
              ) : (
                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={cn(
                "text-xs tabular-nums",
                onTrack ? "text-emerald-600 dark:text-emerald-400" :
                overallPct > data.monthProgress + 15 ? "text-destructive" :
                "text-muted-foreground"
              )}>
                {overallPct}% used · {data.monthProgress}% of month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Remaining */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Remaining</p>
            <p className={cn(
              "text-2xl font-semibold tabular-nums tracking-tight",
              remaining < 0 ? "text-destructive" : "text-foreground"
            )}>
              {fmt(Math.abs(remaining))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {remaining < 0 ? "over budget" : `${data.daysRemaining} days left`}
            </p>
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground mt-3 tabular-nums">
                ~{fmt(Math.round(remaining / data.daysRemaining))}/day available
              </p>
            )}
          </CardContent>
        </Card>

        {/* SIP */}
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Monthly SIPs</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">
              {fmt(data.sip.total)}
            </p>
            {data.sip.nextSIP && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                Next: {data.sip.nextSIP.name.split(" ")[0]} in{" "}
                {data.sip.nextSIP.daysAway === 0
                  ? "today"
                  : `${data.sip.nextSIP.daysAway}d`}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-3 tabular-nums">
              +{fmt(data.subscriptions.total)} subs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Budget pacing ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              Budget Pacing — {format(new Date(), "MMMM yyyy")}
            </CardTitle>
            <Badge variant="outline" className="text-xs tabular-nums">
              Day {new Date().getDate()} of{" "}
              {new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.budgetPacing.map((item) => (
              <div key={item.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{item.category}</span>
                  <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
                    <span>{fmt(item.spent)}</span>
                    <span className="text-border">·</span>
                    <span>{fmt(item.budget)}</span>
                    <span className={cn(
                      "w-8 text-right font-medium",
                      item.pct > 100 ? "text-destructive" :
                      item.pct > data.monthProgress + 15 ? "text-amber-600 dark:text-amber-400" :
                      "text-muted-foreground"
                    )}>
                      {item.pct}%
                    </span>
                  </div>
                </div>
                <PacingBar pct={item.pct} monthProgress={data.monthProgress} />
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-foreground" />
              <span>Spent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-4 rounded-full bg-border/60" />
              <span>Month progress ({data.monthProgress}%)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Bottom row: Scenario + LTGS ── */}
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

          {/* Quick nav to investments */}
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors group">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Investments</p>
                  <p className="text-xl font-semibold tabular-nums">
                    {fmt(data.sip.total)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {data.sip.funds.filter(f => !f.isFrozen).length} active SIPs
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
