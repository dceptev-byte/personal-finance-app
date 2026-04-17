"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Pencil, Check, X, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TaxDeduction { id: number; section: string; description: string; limit: number; used: number; financialYear: string }
interface LTGSTracker { id: number; financialYear: string; exemptionLimit: number; used: number; notes: string | null }
interface FYActuals {
  fy: string;
  currentMonth: string;
  investedTotal: number;
  projectedFYTotal: number;
  byCategory: { categoryId: number | null; categoryName: string; total: number }[];
  monthlyBreakdown: { month: string; total: number }[];
  limit80C: number;
}
interface TaxData { deductions: TaxDeduction[]; ltgs: LTGSTracker | null; fyActuals: FYActuals | null }

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(n % 100000 === 0 ? 0 : 1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Inline editable amount ────────────────────────────────────────────────────

function EditableAmount({
  value, onSave, maxHint,
}: { value: number; onSave: (v: number) => Promise<void>; maxHint?: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  async function commit() {
    const num = Number(draft.replace(/,/g, ""));
    if (isNaN(num) || num < 0) { setDraft(String(value)); setEditing(false); return; }
    setSaving(true);
    try { await onSave(num); setEditing(false); }
    finally { setSaving(false); }
  }

  function cancel() { setDraft(String(value)); setEditing(false); }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 justify-end">
        <span className="text-xs text-muted-foreground">₹</span>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
          className="w-28 rounded-md border border-ring bg-background px-2 py-0.5 text-sm text-right tabular-nums focus:outline-none"
          disabled={saving}
        />
        {maxHint && <span className="text-xs text-muted-foreground">/ {maxHint.toLocaleString("en-IN")}</span>}
        <button onClick={commit} disabled={saving} className="text-emerald-500 hover:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 justify-end group/amount cursor-pointer" onClick={() => setEditing(true)}>
      <p className="text-sm font-semibold tabular-nums">{fmt(value)}</p>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/amount:opacity-100 transition-opacity" />
    </div>
  );
}

// ── 80C Tracker Widget ────────────────────────────────────────────────────────

function EightyCTracker({ actuals }: { actuals: FYActuals }) {
  const pct = Math.min(100, Math.round((actuals.investedTotal / actuals.limit80C) * 100));
  const projPct = Math.min(100, Math.round((actuals.projectedFYTotal / actuals.limit80C) * 100));
  const remaining = actuals.limit80C - actuals.investedTotal;
  const onTrack = projPct >= 95;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            80C — Investment Tracker
          </CardTitle>
          <Badge variant="outline" className="text-xs">FY {actuals.fy}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Invested so far (from transactions)</span>
            <span className="tabular-nums font-semibold">{fmt(actuals.investedTotal)} / {fmt(actuals.limit80C)}</span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-border overflow-hidden">
            {/* Projected bar */}
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-border/50"
              style={{ width: `${projPct}%` }}
            />
            {/* Actual bar */}
            <div
              className={cn(
                "absolute top-0 left-0 h-full rounded-full transition-all",
                pct >= 100 ? "bg-emerald-500" : "bg-foreground"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{pct}% utilised</span>
            {remaining > 0 && (
              <span className="tabular-nums">
                {fmt(remaining)} remaining
              </span>
            )}
          </div>
        </div>

        {/* Projection */}
        <div className={cn(
          "rounded-lg px-3 py-2 text-xs flex items-center justify-between",
          onTrack ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        )}>
          <span>FY projection at current pace</span>
          <span className="font-semibold tabular-nums">{fmt(actuals.projectedFYTotal)}</span>
        </div>

        {/* Per-category breakdown */}
        {actuals.byCategory.length > 0 && (
          <div className="space-y-1 pt-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">By fund / category</p>
            {actuals.byCategory.sort((a, b) => b.total - a.total).map(cat => (
              <div key={cat.categoryId ?? cat.categoryName} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{cat.categoryName}</span>
                <span className="tabular-nums font-medium shrink-0 ml-2">{fmt(cat.total)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Deduction Row ─────────────────────────────────────────────────────────────

function DeductionRow({ d, onUpdate }: { d: TaxDeduction; onUpdate: (id: number, used: number) => void }) {
  const pct = Math.min(100, Math.round((d.used / d.limit) * 100));
  const full = pct >= 100;

  async function save(used: number) {
    const res = await fetch("/api/tax", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id, used, table: "deductions" }),
    });
    if (!res.ok) { toast.error("Failed to save"); throw new Error(); }
    toast.success(`${d.section} updated`);
    onUpdate(d.id, used);
  }

  return (
    <div className="py-4 border-b border-border last:border-0 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{d.section}</span>
            {full && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>
        </div>
        <div className="text-right">
          <EditableAmount value={d.used} onSave={save} maxHint={d.limit} />
          <p className="text-xs text-muted-foreground">limit {fmt(d.limit)}</p>
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", full ? "bg-emerald-500" : "bg-foreground")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tax").then(r => r.json()).then((d: TaxData) => setData(d as TaxData)).finally(() => setLoading(false));
  }, []);

  function updateDeduction(id: number, used: number) {
    setData(prev => prev ? { ...prev, deductions: prev.deductions.map(d => d.id === id ? { ...d, used } : d) } : prev);
  }

  async function updateLtgs(used: number) {
    if (!data?.ltgs) return;
    const res = await fetch("/api/tax", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: data.ltgs.id, used, table: "ltgs" }),
    });
    if (!res.ok) { toast.error("Failed to save"); throw new Error(); }
    toast.success("LTGS updated");
    setData(prev => prev?.ltgs ? { ...prev, ltgs: { ...prev.ltgs, used } } : prev);
  }

  if (loading) return (
    <div className="space-y-4">
      {[0, 1].map(i => <Card key={i}><CardContent className="pt-6 space-y-3">{[0, 1, 2].map(j => <Skeleton key={j} className="h-12 w-full" />)}</CardContent></Card>)}
    </div>
  );
  if (!data) return <p className="text-muted-foreground text-sm">Failed to load tax data.</p>;

  const totalSaved = data.deductions.reduce((s, d) => s + d.used, 0);

  return (
    <div className="space-y-6">
      {/* 80C Tracker */}
      {data.fyActuals && <EightyCTracker actuals={data.fyActuals} />}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total deductions</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(totalSaved)}</p>
            <p className="text-xs text-muted-foreground mt-1">FY {data.deductions[0]?.financialYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Sections maxed</p>
            <p className="text-2xl font-semibold tabular-nums">
              {data.deductions.filter(d => d.used >= d.limit).length} / {data.deductions.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">fully utilised</p>
          </CardContent>
        </Card>
        {data.ltgs && (
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">LTGS remaining</p>
                  <p className="text-2xl font-semibold tabular-nums">{fmt(data.ltgs.exemptionLimit - data.ltgs.used)}</p>
                  <p className="text-xs text-muted-foreground mt-1">of {fmt(data.ltgs.exemptionLimit)} exemption</p>
                </div>
                {data.ltgs.used < data.ltgs.exemptionLimit && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Deductions — click any amount to edit */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Tax Deductions</CardTitle>
            <p className="text-xs text-muted-foreground">Click any amount to edit</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {data.deductions.map(d => (
            <DeductionRow key={d.id} d={d} onUpdate={updateDeduction} />
          ))}
        </CardContent>
      </Card>

      {/* LTGS detail */}
      {data.ltgs && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">LTGS Tracker — FY {data.ltgs.financialYear}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Gains realised (used)</span>
              <EditableAmount value={data.ltgs.used} onSave={updateLtgs} maxHint={data.ltgs.exemptionLimit} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining exemption</span>
              <span className="tabular-nums font-medium text-amber-600 dark:text-amber-400">
                {fmt(data.ltgs.exemptionLimit - data.ltgs.used)}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.round((data.ltgs.used / data.ltgs.exemptionLimit) * 100)}%` }}
              />
            </div>
            {data.ltgs.notes && (
              <p className="text-xs text-muted-foreground pt-1 border-t border-border">{data.ltgs.notes}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
