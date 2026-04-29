"use client";

import { useEffect, useState } from "react";
import { format, addDays, setDate } from "date-fns";
import { TrendingUp, RefreshCw, ChevronDown, ChevronUp, Pencil, X, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Investment {
  id: number; type: string; fundName: string;
  categoryId: number | null;
  monthlyAmount: number; stepUpPercent: number | null;
  stepUpMode: string | null; sipDate: number | null;
  platform: string | null; isFrozen: boolean;
  currentValue: number | null; notes: string | null;
}

interface InvestmentCategory { id: number; name: string }

interface Saving {
  id: number;
  name: string;
  institution: string | null;
  type: string;
  monthlyAmount: number;
  interestRate: number | null;
  tenureMonths: number | null;
  categoryId: number | null;
  isActive: boolean;
  notes: string | null;
}

interface ProjectionPoint { year: number; invested: number; value: number; gain: number }
interface ProjectionResult {
  data: ProjectionPoint[];
  summary: { totalInvested: number; finalValue: number; totalGain: number; xReturn: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function nextSIPDate(sipDate: number): string {
  const today = new Date();
  const thisMonth = setDate(today, sipDate);
  const target = thisMonth >= today ? thisMonth : setDate(addDays(today, 31), sipDate);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${format(target, "d MMM")} (${diff}d)`;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({ inv, categories, onClose, onSaved }: { inv: Investment; categories: InvestmentCategory[]; onClose: () => void; onSaved: (updated: Investment) => void }) {
  const [form, setForm] = useState({
    fundName: inv.fundName,
    type: inv.type,
    categoryId: inv.categoryId ?? "",
    monthlyAmount: inv.monthlyAmount,
    sipDate: inv.sipDate ?? 1,
    stepUpPercent: inv.stepUpPercent ?? 10,
    stepUpMode: inv.stepUpMode ?? "manual",
    platform: inv.platform ?? "",
    currentValue: inv.currentValue ?? 0,
    isFrozen: inv.isFrozen,
    notes: inv.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/investments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inv.id, ...form, categoryId: form.categoryId === "" ? null : Number(form.categoryId) }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Investment;
      toast.success("SIP updated");
      onSaved(updated);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = "text", extra?: object) => (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={String(form[key])}
        onChange={e => setForm(f => ({ ...f, [key]: type === "number" ? Number(e.target.value) : e.target.value }))}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        {...extra}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit SIP</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          {field("Fund name", "fundName")}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {["Equity", "Index", "Debt", "Hybrid", "Retirement", "ELSS"].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {field("Platform", "platform")}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Budget category</label>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">— unassigned —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Monthly amount (₹)", "monthlyAmount", "number")}
            {field("SIP date (day of month)", "sipDate", "number")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("Step-up (%)", "stepUpPercent", "number")}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Step-up mode</label>
              <select value={form.stepUpMode} onChange={e => setForm(f => ({ ...f, stepUpMode: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="auto">Auto</option>
                <option value="manual">Manual</option>
              </select>
            </div>
          </div>
          {field("Current portfolio value (₹)", "currentValue", "number")}
          {field("Notes", "notes")}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isFrozen} onChange={e => setForm(f => ({ ...f, isFrozen: e.target.checked }))}
              className="rounded border-border" />
            <span className="text-muted-foreground">Frozen (paused SIP)</span>
          </label>
        </div>

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── SIP Card ─────────────────────────────────────────────────────────────────

function SIPCard({ inv, onEdit }: { inv: Investment; onEdit: () => void }) {
  return (
    <div className={cn(
      "flex items-center justify-between py-4 border-b border-border last:border-0 group",
      inv.isFrozen && "opacity-50"
    )}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{inv.fundName}</span>
          <Badge variant="outline" className="text-xs font-normal">{inv.type}</Badge>
          {inv.isFrozen && <Badge variant="secondary" className="text-xs">Frozen</Badge>}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {inv.platform && <span>{inv.platform}</span>}
          {inv.sipDate && !inv.isFrozen && (
            <span>Next SIP: {nextSIPDate(inv.sipDate)}</span>
          )}
          {inv.stepUpPercent ? (
            <span>{inv.stepUpPercent}% step-up {inv.stepUpMode === "auto" ? "(auto)" : "(manual)"}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">{fmt(inv.monthlyAmount)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
          {inv.currentValue ? (
            <p className="text-xs text-muted-foreground tabular-nums">Portfolio: {fmt(inv.currentValue)}</p>
          ) : null}
        </div>
        <button onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Portfolio Projector ───────────────────────────────────────────────────────

function PortfolioProjector({ defaultMonthly }: { defaultMonthly: number }) {
  const [params, setParams] = useState({
    monthlyAmount: defaultMonthly,
    stepUpPct: 10,
    years: 15,
    expectedReturn: 12,
  });
  const [result, setResult] = useState<ProjectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function project() {
    setLoading(true);
    try {
      const res = await fetch("/api/investments/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json() as ProjectionResult;
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { project(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fields = [
    { key: "monthlyAmount", label: "Monthly SIP (₹)", step: 1000 },
    { key: "stepUpPct",     label: "Annual step-up (%)", step: 1 },
    { key: "years",          label: "Time horizon (yrs)", step: 1 },
    { key: "expectedReturn", label: "Expected return (%)", step: 0.5 },
  ] as const;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Portfolio Projector
          </CardTitle>
          <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {fields.map(({ key, label, step }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{label}</label>
                <input
                  type="number"
                  step={step}
                  value={params[key]}
                  onChange={(e) => setParams((p) => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ))}
          </div>
          <Button size="sm" onClick={project} disabled={loading} className="w-full">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : null}
            Project
          </Button>

          {result && (
            <>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Invested", value: fmt(result.summary.totalInvested) },
                  { label: "Final value", value: fmt(result.summary.finalValue) },
                  { label: "Total gain", value: fmt(result.summary.totalGain) },
                  { label: "Return", value: `${result.summary.xReturn}x` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg bg-muted p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="w-full">
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={result.data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `Y${v}`} />
                    <YAxis tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} tickFormatter={(v) => fmt(v)} width={60} />
                    <Tooltip
                      formatter={(value, name) => [fmt(Number(value)), name === "value" ? "Portfolio value" : "Amount invested"]}
                      labelFormatter={(label) => `Year ${label}`}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #27272a", background: "#18181b" }}
                    />
                    <Area type="monotone" dataKey="invested" stroke="#6b7280" strokeWidth={1.5} fill="url(#investedGrad)" />
                    <Area type="monotone" dataKey="value" stroke="#a5b4fc" strokeWidth={2} fill="url(#valueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center">
                <div className="flex items-center gap-1.5"><div className="h-0.5 w-4 rounded" style={{ background: "#a5b4fc" }} /><span>Portfolio value</span></div>
                <div className="flex items-center gap-1.5"><div className="h-0.5 w-4 rounded" style={{ background: "#6b7280" }} /><span>Amount invested</span></div>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ── Savings Section ───────────────────────────────────────────────────────────

const SAVING_TYPE_LABELS: Record<string, string> = {
  fd: "Fixed Deposit", rd: "Recurring Deposit",
  ppf: "PPF", nps: "NPS", savings: "Savings Account",
};

function maturityAmount(monthly: number, annualRate: number, tenureMonths: number) {
  // Simple interest per FD tranche: P × (1 + r/12 × tenure)
  const r = annualRate / 100;
  return monthly * (1 + (r / 12) * tenureMonths);
}

function SavingEditModal({ saving, categories, onClose, onSaved }: {
  saving: Saving; categories: InvestmentCategory[];
  onClose: () => void; onSaved: (s: Saving) => void;
}) {
  const [form, setForm] = useState({
    name: saving.name,
    institution: saving.institution ?? "",
    type: saving.type,
    monthlyAmount: saving.monthlyAmount,
    interestRate: saving.interestRate ?? 0,
    tenureMonths: saving.tenureMonths ?? 0,
    categoryId: saving.categoryId ?? "",
    isActive: saving.isActive,
    notes: saving.notes ?? "",
  });
  const [saving_, setSaving_] = useState(false);

  async function save() {
    setSaving_(true);
    try {
      const res = await fetch("/api/savings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: saving.id, ...form,
          categoryId: form.categoryId === "" ? null : Number(form.categoryId),
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Saving;
      toast.success("Saved");
      onSaved(updated);
    } catch { toast.error("Failed to save"); }
    finally { setSaving_(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Edit saving</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {Object.entries(SAVING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Institution</label>
              <input type="text" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Monthly (₹)</label>
              <input type="number" value={form.monthlyAmount} onChange={e => setForm(f => ({ ...f, monthlyAmount: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Rate (% p.a.)</label>
              <input type="number" value={form.interestRate} step="0.1" onChange={e => setForm(f => ({ ...f, interestRate: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tenure (mo)</label>
              <input type="number" value={form.tenureMonths} onChange={e => setForm(f => ({ ...f, tenureMonths: Number(e.target.value) }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Budget category</label>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">— unassigned —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="rounded border-border" />
            <span className="text-muted-foreground">Active</span>
          </label>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving_}>
            {saving_ ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function SavingsSection({ categories }: { categories: InvestmentCategory[] }) {
  const [items, setItems] = useState<Saving[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Saving | null>(null);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", institution: "", type: "fd", monthlyAmount: 0, interestRate: 0, tenureMonths: 0, categoryId: "" });
  const [saving_, setSaving_] = useState(false);

  useEffect(() => {
    fetch("/api/savings").then(r => r.json()).then((d: Saving[]) => setItems(d)).finally(() => setLoaded(true));
  }, []);

  async function addNew() {
    setSaving_(true);
    try {
      const res = await fetch("/api/savings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newForm, categoryId: newForm.categoryId === "" ? null : Number(newForm.categoryId) }),
      });
      const created = await res.json() as Saving;
      setItems(prev => [...prev, created]);
      setAdding(false);
      setNewForm({ name: "", institution: "", type: "fd", monthlyAmount: 0, interestRate: 0, tenureMonths: 0, categoryId: "" });
      toast.success("Added");
    } catch { toast.error("Failed to add"); }
    finally { setSaving_(false); }
  }

  async function remove(id: number) {
    await fetch(`/api/savings?id=${id}`, { method: "DELETE" });
    setItems(prev => prev.filter(s => s.id !== id));
    toast.success("Removed");
  }

  const active = items.filter(s => s.isActive);
  const totalMonthly = active.reduce((s, i) => s + i.monthlyAmount, 0);

  if (!loaded) return null;

  return (
    <>
      {editing && (
        <SavingEditModal
          saving={editing} categories={categories}
          onClose={() => setEditing(null)}
          onSaved={updated => { setItems(prev => prev.map(s => s.id === updated.id ? updated : s)); setEditing(null); }}
        />
      )}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Savings / Emergency Reserve</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(totalMonthly)}/mo</span>
              <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" />Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-0">
          {active.map((s, i) => {
            const maturity = s.interestRate && s.tenureMonths
              ? maturityAmount(s.monthlyAmount, s.interestRate, s.tenureMonths)
              : null;
            const interestEarned = maturity ? maturity - s.monthlyAmount : null;
            return (
              <div key={s.id} className={cn(
                "flex items-center justify-between py-3 group",
                i < active.length - 1 && "border-b border-border"
              )}>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{s.name}</span>
                    <Badge variant="outline" className="text-xs font-normal">
                      {SAVING_TYPE_LABELS[s.type] ?? s.type}
                    </Badge>
                    {s.institution && <span className="text-xs text-muted-foreground">{s.institution}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {s.interestRate && <span>{s.interestRate}% p.a.</span>}
                    {s.tenureMonths && <span>{s.tenureMonths}-month tenure</span>}
                    {maturity && interestEarned && (
                      <span>Matures to {fmt(maturity)} (+{fmt(interestEarned)} interest)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{fmt(s.monthlyAmount)}<span className="text-xs font-normal text-muted-foreground">/mo</span></p>
                    {s.tenureMonths && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt(s.monthlyAmount * s.tenureMonths)} over {s.tenureMonths}mo
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(s)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(s.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {adding && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">New saving</p>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Name" value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {Object.entries(SAVING_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input placeholder="Institution" value={newForm.institution} onChange={e => setNewForm(f => ({ ...f, institution: e.target.value }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="number" placeholder="Monthly (₹)" value={newForm.monthlyAmount || ""} onChange={e => setNewForm(f => ({ ...f, monthlyAmount: Number(e.target.value) }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="number" placeholder="Rate % p.a." step="0.1" value={newForm.interestRate || ""} onChange={e => setNewForm(f => ({ ...f, interestRate: Number(e.target.value) }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="number" placeholder="Tenure (months)" value={newForm.tenureMonths || ""} onChange={e => setNewForm(f => ({ ...f, tenureMonths: Number(e.target.value) }))}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <select value={newForm.categoryId} onChange={e => setNewForm(f => ({ ...f, categoryId: e.target.value }))}
                  className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">— no budget category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addNew} disabled={saving_ || !newForm.name || !newForm.monthlyAmount}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function InvestmentsClient() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentCategories, setInvestmentCategories] = useState<InvestmentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Investment | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/investments").then(r => r.json()) as Promise<Investment[]>,
      fetch("/api/budgets?month=2026-01").then(r => r.json()).then((rows: { categoryId: number; categoryName: string; tier: string }[]) =>
        rows.filter(r => r.tier === "investment").map(r => ({ id: r.categoryId, name: r.categoryName }))
      ),
    ]).then(([invs, cats]) => {
      setInvestments(invs);
      setInvestmentCategories(cats);
    }).finally(() => setLoading(false));
  }, []);

  function handleSaved(updated: Investment) {
    setInvestments(prev => prev.map(i => i.id === updated.id ? updated : i));
    setEditing(null);
  }

  const active = investments.filter((i) => !i.isFrozen);
  const frozen = investments.filter((i) => i.isFrozen);
  const totalMonthly = active.reduce((s, i) => s + i.monthlyAmount, 0);
  const totalAnnual = active.reduce((s, i) => s + i.monthlyAmount * 12, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card><CardContent className="pt-6 space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</CardContent></Card>
        <Card><CardContent className="pt-6 h-64"><Skeleton className="h-full w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {editing && <EditModal inv={editing} categories={investmentCategories} onClose={() => setEditing(null)} onSaved={handleSaved} />}

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Monthly SIPs</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(totalMonthly)}</p>
            <p className="text-xs text-muted-foreground mt-1">{active.length} active funds</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Annual SIPs</p>
            <p className="text-2xl font-semibold tabular-nums">{fmt(totalAnnual)}</p>
            <p className="text-xs text-muted-foreground mt-1">per year deployed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Next step-up</p>
            <p className="text-2xl font-semibold tabular-nums">
              {fmt(active.reduce((s, i) => s + Math.round(i.monthlyAmount * (1 + (i.stepUpPercent ?? 10) / 100)), 0))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">after 10% annual increase</p>
          </CardContent>
        </Card>
      </div>

      {/* SIP list */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Active SIPs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {active.map((inv) => <SIPCard key={inv.id} inv={inv} onEdit={() => setEditing(inv)} />)}
          {frozen.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground mt-4 mb-2">Frozen</p>
              {frozen.map((inv) => <SIPCard key={inv.id} inv={inv} onEdit={() => setEditing(inv)} />)}
            </>
          )}
        </CardContent>
      </Card>

      {/* Savings / ER */}
      <SavingsSection categories={investmentCategories} />

      {/* Portfolio projector */}
      <PortfolioProjector defaultMonthly={totalMonthly} />
    </div>
  );
}
