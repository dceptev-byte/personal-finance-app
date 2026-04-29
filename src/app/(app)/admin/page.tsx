"use client";

import { useEffect, useState, useCallback } from "react";
import { Database, Cpu, HardDrive, RefreshCw, CheckCircle2, XCircle, Play, DollarSign, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, subMonths } from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────

interface AdminData {
  db: { path: string; sizeMb: string | null; counts: { transactions: number; categories: number; investments: number; vaultEntries: number; learnedMappings: number } };
  ollama: { ok: boolean; model?: string; error?: string };
  backup: { dest: string; ssdMounted: boolean; lastBackup: string | null };
}

interface BudgetRow {
  categoryId: number;
  categoryName: string;
  tier: string;
  color: string;
  budgetId: number | null;
  amount: number;
  autoFromSchedule?: boolean;
  autoFromSIPs?: boolean;
  autoFromAnnual?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

const TIER_LABELS: Record<string, string> = {
  income: "Income",
  fixed: "Fixed Commitments",
  investment: "Investments & Savings",
  discretionary: "Discretionary",
  misc: "Misc.",
};

const TIER_ORDER = ["fixed", "investment", "discretionary", "misc"];

// ── Budget Editor ─────────────────────────────────────────────────────────

function BudgetEditor() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [edited, setEdited] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const prevMonth = format(subMonths(new Date(month + "-01"), 1), "yyyy-MM");

  const load = useCallback(async (m: string) => {
    const res = await fetch(`/api/budgets?month=${m}`);
    const data = await res.json() as BudgetRow[];
    setRows(data);
    setEdited({});
  }, []);

  useEffect(() => { load(month); }, [month, load]);

  async function saveAll() {
    if (Object.keys(edited).length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(edited).map(([catId, amount]) =>
          fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ categoryId: Number(catId), month, amount }),
          })
        )
      );
      toast.success("Budgets saved");
      load(month);
    } catch {
      toast.error("Failed to save budgets");
    } finally {
      setSaving(false);
    }
  }

  async function copyFromPrev() {
    setCopying(true);
    try {
      const res = await fetch(`/api/budgets?from=${prevMonth}&to=${month}`, { method: "PUT" });
      const data = await res.json() as { ok?: boolean; error?: string; copied?: number };
      if (!res.ok) throw new Error(data.error);
      toast.success(`Copied ${data.copied} budget entries from ${prevMonth}`);
      load(month);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCopying(false);
    }
  }

  const byTier = TIER_ORDER.reduce<Record<string, BudgetRow[]>>((acc, t) => {
    acc[t] = rows.filter(r => r.tier === t);
    return acc;
  }, {});

  const totalBudget = rows.reduce((s, r) => s + (edited[r.categoryId] ?? r.amount), 0);
  const hasEdits = Object.keys(edited).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Monthly Budgets
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Controls */}
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="sm" variant="outline" onClick={copyFromPrev} disabled={copying}>
            {copying ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            Copy from {prevMonth}
          </Button>
          {hasEdits && (
            <Button size="sm" onClick={saveAll} disabled={saving}>
              {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Save changes
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            Total: {fmt(totalBudget)}
          </span>
        </div>

        {/* Budget rows grouped by tier */}
        {TIER_ORDER.map(tier => {
          const tierRows = byTier[tier] ?? [];
          if (tierRows.length === 0) return null;
          const tierTotal = tierRows.reduce((s, r) => s + (edited[r.categoryId] ?? r.amount), 0);
          return (
            <div key={tier}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {TIER_LABELS[tier]}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(tierTotal)}</span>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                {tierRows.map((row, i) => {
                  const val = edited[row.categoryId] ?? row.amount;
                  return (
                    <div key={row.categoryId} className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm",
                      i < tierRows.length - 1 && "border-b border-border"
                    )}>
                      <span className="flex-1 text-sm">{row.categoryName}</span>
                      {(row.autoFromSchedule || row.autoFromSIPs || row.autoFromAnnual) && edited[row.categoryId] === undefined && (
                        <span className="text-xs text-muted-foreground italic">
                          {row.autoFromSchedule ? "schedule" : row.autoFromSIPs ? "SIPs" : "annual"}
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">₹</div>
                      <input
                        type="number"
                        value={val || ""}
                        placeholder="0"
                        readOnly={(row.autoFromSchedule || row.autoFromSIPs || row.autoFromAnnual) && edited[row.categoryId] === undefined}
                        onChange={e => {
                          if (row.autoFromSchedule) return;
                          setEdited(prev => ({ ...prev, [row.categoryId]: Number(e.target.value) }));
                        }}
                        className={cn(
                          "w-28 rounded border border-border px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring",
                          (row.autoFromSchedule || row.autoFromSIPs || row.autoFromAnnual) && edited[row.categoryId] === undefined
                            ? "bg-muted text-muted-foreground cursor-default"
                            : "bg-background"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin");
      setData(await res.json() as AdminData);
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  async function runBackup() {
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup" }),
      });
      const result = await res.json() as { ok?: boolean; message?: string; error?: string };
      if (result.ok) { toast.success(result.message ?? "Backup complete"); load(); }
      else toast.error(result.error ?? "Backup failed");
    } catch {
      toast.error("Backup failed");
    } finally {
      setBackingUp(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 max-w-2xl">

      {/* Budget Editor */}
      <BudgetEditor />

      {/* Database */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            Database
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-0">
          <StatRow label="File" value={data.db.path.replace(/^.*\//, "")} />
          <StatRow label="Size" value={data.db.sizeMb ? `${data.db.sizeMb} MB` : "—"} />
          <StatRow label="Transactions" value={data.db.counts.transactions.toLocaleString()} />
          <StatRow label="Categories" value={data.db.counts.categories} />
          <StatRow label="Investments" value={data.db.counts.investments} />
          <StatRow label="Vault entries" value={data.db.counts.vaultEntries} />
          <StatRow label="Learned mappings" value={data.db.counts.learnedMappings} />
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground font-mono break-all">{data.db.path}</p>
          </div>
        </CardContent>
      </Card>

      {/* Ollama */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Ollama
            <span className={cn("ml-auto flex items-center gap-1.5 text-xs font-normal", data.ollama.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {data.ollama.ok ? <><CheckCircle2 className="h-3.5 w-3.5" />Connected</> : <><XCircle className="h-3.5 w-3.5" />Offline</>}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <StatRow label="Status" value={data.ollama.ok ? "Running" : "Not reachable"} />
          <StatRow label="Model" value={data.ollama.model ?? "—"} />
          <StatRow label="Endpoint" value="localhost:11434" />
          {data.ollama.error && <p className="text-xs text-destructive mt-2">{data.ollama.error}</p>}
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Backup
            <Badge variant="outline" className={cn("ml-auto text-xs", data.backup.ssdMounted ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400" : "border-destructive/50 text-destructive")}>
              {data.backup.ssdMounted ? "SSD mounted" : "SSD not found"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div>
            <StatRow label="Destination" value={data.backup.dest || "Not configured"} />
            <StatRow label="Last backup" value={data.backup.lastBackup ? data.backup.lastBackup.replace("finance_", "").replace(".db", "") : "None yet"} />
          </div>
          <Button size="sm" variant="outline" onClick={runBackup} disabled={backingUp || !data.backup.ssdMounted} className="w-full">
            {backingUp ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Backing up…</> : <><Play className="h-3.5 w-3.5 mr-2" />Run backup now</>}
          </Button>
          {!data.backup.ssdMounted && <p className="text-xs text-muted-foreground text-center">Mount your SSD to enable backup</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={load} className="text-xs text-muted-foreground gap-1.5">
          <RefreshCw className="h-3 w-3" />Refresh
        </Button>
      </div>
    </div>
  );
}
