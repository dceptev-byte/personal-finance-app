"use client";

import { useEffect, useRef, useState } from "react";
import { format, subMonths } from "date-fns";
import { Upload, Plus, Trash2, Check, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface Category { id: number; name: string; color: string }
interface Transaction {
  id: number; date: string; description: string; amount: number;
  month: string; source: string; notes: string | null;
  isVerified: boolean; categoryId: number | null;
  categoryName: string | null; categoryColor: string | null;
  isSplit: boolean | null; parentId: number | null; splitLabel: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function MonthPicker({ value, onChange, extraMonths = [] }: { value: string; onChange: (m: string) => void; extraMonths?: string[] }) {
  // Last 24 months + any extra months from imports that fall outside that window
  const recent = Array.from({ length: 24 }, (_, i) => format(subMonths(new Date(), i), "yyyy-MM"));
  const all = [...new Set([...recent, ...extraMonths])].sort((a, b) => b.localeCompare(a));
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-border bg-background pl-3 pr-8 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {all.map((m) => (
          <option key={m} value={m}>
            {format(new Date(m + "-01"), "MMMM yyyy")}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

// ── Add Transaction Modal ─────────────────────────────────────────────────

function AddModal({
  categories, onClose, onSave,
}: {
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    amount: "",
    categoryId: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.date || !form.description || !form.amount) return;
    setSaving(true);
    try {
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          description: form.description,
          amount: parseFloat(form.amount),
          categoryId: form.categoryId ? Number(form.categoryId) : undefined,
          notes: form.notes || undefined,
        }),
      });
      toast.success("Transaction added");
      onSave();
    } catch {
      toast.error("Failed to add transaction");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-semibold">Add Transaction</h2>
        <div className="space-y-3">
          {[
            { label: "Date", key: "date", type: "date" },
            { label: "Description", key: "description", type: "text" },
            { label: "Amount (₹)", key: "amount", type: "number" },
          ].map(({ label, key, type }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-muted-foreground">{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">— Uncategorised —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Import Panel ──────────────────────────────────────────────────────────

function ImportPanel({ onImported }: { onImported: (latestMonth: string, months: string[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ rowCount: number; importId: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) {
      toast.error("Only CSV files are supported right now");
      return;
    }
    setImporting(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const data = await res.json() as { rowCount?: number; skipped?: number; importId?: number; latestMonth?: string; months?: string[]; categorised?: { fromMappings: number; fromAI: number; uncategorised: number }; error?: string; message?: string };
      if (!res.ok) throw new Error(data.error);
      setResult({ rowCount: data.rowCount!, importId: data.importId! });
      const { fromMappings = 0, uncategorised = 0 } = data.categorised ?? {};
      const skippedNote = data.skipped ? ` · ${data.skipped} skipped (already exist)` : "";
      const msg = data.rowCount === 0
        ? (data.message ?? "Nothing new to import — all transactions already exist")
        : fromMappings > 0
          ? `${data.rowCount} imported · ${fromMappings} auto-categorised · ${uncategorised} need review${skippedNote}`
          : `${data.rowCount} imported · review & categorise below${skippedNote}`;
      toast.success(msg);
      onImported(data.latestMonth ?? format(new Date(), "yyyy-MM"), data.months ?? []);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      className={cn(
        "rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
        dragging ? "border-foreground bg-muted" : "border-border hover:border-muted-foreground"
      )}
      onClick={() => fileRef.current?.click()}
    >
      <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      {importing ? (
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Importing transactions…</p>
        </div>
      ) : result ? (
        <div className="flex flex-col items-center gap-1">
          <Check className="h-6 w-6 text-emerald-500" />
          <p className="text-sm font-medium">{result.rowCount} transactions imported</p>
          <p className="text-xs text-muted-foreground">Review and verify them below</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Drop bank statement CSV here</p>
          <p className="text-xs text-muted-foreground">or click to browse · Axis Bank CSV supported</p>
        </div>
      )}
    </div>
  );
}

// ── Transaction Row ───────────────────────────────────────────────────────

function TxRow({
  tx, categories, onUpdate, onDelete, indent = false,
}: {
  tx: Transaction;
  categories: Category[];
  onUpdate: (id: number, patch: Partial<Transaction>) => void;
  onDelete: (id: number) => void;
  indent?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [catId, setCatId] = useState<string>(tx.categoryId?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function saveCategory() {
    setSaving(true);
    try {
      await fetch(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: catId ? Number(catId) : null, isVerified: true }),
      });
      const cat = categories.find((c) => c.id === Number(catId));
      onUpdate(tx.id, { categoryId: catId ? Number(catId) : null, categoryName: cat?.name ?? null, categoryColor: cat?.color ?? null, isVerified: true });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    await fetch(`/api/transactions/${tx.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVerified: true }),
    });
    onUpdate(tx.id, { isVerified: true });
  }

  async function del() {
    await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    onDelete(tx.id);
  }

  return (
    <div className={cn(
      "flex items-center gap-3 py-2.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group",
      indent ? "pl-10 pr-4 bg-muted/10" : "px-4",
      !tx.isVerified && !indent && "bg-amber-50/30 dark:bg-amber-950/10"
    )}>
      {/* Date */}
      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
        {indent ? (tx.splitLabel ?? "Split") : format(new Date(tx.date), "dd MMM")}
      </span>

      {/* Description */}
      <span className={cn("flex-1 text-sm truncate", indent && "text-muted-foreground text-xs")} title={tx.description}>
        {indent ? (tx.splitLabel ?? tx.description) : tx.description}
      </span>

      {/* Category */}
      <div className="w-36 shrink-0">
        {editing ? (
          <div className="flex gap-1">
            <select
              autoFocus
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={saveCategory} disabled={saving} className="rounded border border-border px-1.5 hover:bg-muted">
              {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 rounded px-2 py-0.5 hover:bg-muted transition-colors"
          >
            {tx.categoryName ? (
              <Badge variant="secondary" className="text-xs font-normal">
                {tx.categoryName}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground italic">Uncategorised</span>
            )}
          </button>
        )}
      </div>

      {/* Amount */}
      <span className={cn("w-24 shrink-0 text-right tabular-nums", indent ? "text-xs text-muted-foreground" : "text-sm font-medium")}>
        {fmt(tx.amount)}
      </span>

      {/* Actions — verify always visible on child rows, hover-only on parents */}
      <div className={cn("flex items-center gap-1 transition-opacity", indent ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
        {!tx.isVerified && (
          <button onClick={verify} className="rounded p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-600" title="Verify">
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={del} className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900 text-muted-foreground hover:text-destructive" title="Delete">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Unverified dot */}
      {!tx.isVerified && !indent && (
        <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Needs verification" />
      )}
    </div>
  );
}

// ── Split Parent Row (with expand toggle) ─────────────────────────────────

function SplitParentRow({
  tx, children, categories, onUpdate, onDelete,
}: {
  tx: Transaction;
  children: Transaction[];
  categories: Category[];
  onUpdate: (id: number, patch: Partial<Transaction>) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <div className={cn(
        "flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-muted/30 transition-colors group",
        !tx.isVerified && "bg-amber-50/30 dark:bg-amber-950/10"
      )}>
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 rounded p-0.5 hover:bg-muted transition-colors text-muted-foreground"
          title={expanded ? "Collapse splits" : "Expand splits"}
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>

        {/* Date */}
        <span className="w-[72px] shrink-0 text-xs tabular-nums text-muted-foreground">
          {format(new Date(tx.date), "dd MMM")}
        </span>

        {/* Description */}
        <span className="flex-1 text-sm truncate" title={tx.description}>
          {tx.description}
        </span>

        {/* Split badge */}
        <div className="w-36 shrink-0">
          <span className="text-xs text-muted-foreground italic">
            {children.length} splits
          </span>
        </div>

        {/* Amount */}
        <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums">
          {fmt(tx.amount)}
        </span>

        {/* Spacer for actions column */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={async () => {
              await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
              onDelete(tx.id);
              for (const c of children) onDelete(c.id);
            }}
            className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900 text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Unverified dot */}
        {!tx.isVerified && (
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Needs verification" />
        )}
      </div>

      {/* Children */}
      {expanded && children.map(child => (
        <TxRow
          key={child.id}
          tx={child}
          categories={categories}
          onUpdate={onUpdate}
          onDelete={onDelete}
          indent
        />
      ))}
    </>
  );
}

// ── Main Expenses Page ────────────────────────────────────────────────────

export function ExpensesClient() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [extraMonths, setExtraMonths] = useState<string[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  async function loadTxs(m: string) {
    setLoading(true);
    const res = await fetch(`/api/transactions?month=${m}`);
    const data = await res.json() as Transaction[];
    setTxs(data);
    setLoading(false);
  }

  function handleImported(latestMonth: string, months: string[]) {
    setExtraMonths(prev => [...new Set([...prev, ...months])]);
    setMonth(latestMonth);
    loadTxs(latestMonth);
  }

  useEffect(() => { loadTxs(month); }, [month]);
  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d: Category[]) => setCategories(d));
  }, []);

  function updateTx(id: number, patch: Partial<Transaction>) {
    setTxs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  function deleteTx(id: number) {
    setTxs((prev) => prev.filter((t) => t.id !== id));
  }

  // Separate top-level rows (parents and non-split) from children
  const topLevel = txs.filter(t => t.parentId == null);
  const childrenByParent = new Map<number, Transaction[]>();
  for (const t of txs) {
    if (t.parentId != null) {
      const arr = childrenByParent.get(t.parentId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentId, arr);
    }
  }

  // Total: sum only top-level rows (children are sub-components of parents)
  const total = topLevel.reduce((s, t) => s + t.amount, 0);
  const unverified = topLevel.filter((t) => !t.isVerified).length;

  return (
    <div className="space-y-6">
      {showAdd && (
        <AddModal categories={categories} onClose={() => setShowAdd(false)} onSave={() => { setShowAdd(false); loadTxs(month); }} />
      )}

      {/* Import */}
      <ImportPanel onImported={handleImported} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MonthPicker value={month} onChange={(m) => { setMonth(m); }} extraMonths={extraMonths} />
          {unverified > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
              {unverified} need verification
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">
            {topLevel.length} transactions · {fmt(total)}
          </span>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Transaction list */}
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground">
            {format(new Date(month + "-01"), "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pt-2">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : txs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No transactions for this month</p>
              <p className="text-xs text-muted-foreground mt-1">Import a statement or add one manually</p>
            </div>
          ) : (
            <div>
              {topLevel.map((tx) => {
                const children = childrenByParent.get(tx.id);
                if (tx.isSplit && children && children.length > 0) {
                  return (
                    <SplitParentRow
                      key={tx.id}
                      tx={tx}
                      children={children}
                      categories={categories}
                      onUpdate={updateTx}
                      onDelete={deleteTx}
                    />
                  );
                }
                return (
                  <TxRow key={tx.id} tx={tx} categories={categories} onUpdate={updateTx} onDelete={deleteTx} />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
