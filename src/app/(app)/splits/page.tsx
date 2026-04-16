"use client";

import { useEffect, useState } from "react";
import { Plus, ChevronDown, ChevronUp, Trash2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Category { id: number; name: string; color: string }
interface AmorRow { id: number; loanId: number; month: string; emi: number; principal: number; interest: number; balance: number | null }
interface Loan {
  id: number; name: string; keyword: string; originalAmount: number | null;
  startDate: string | null; principalCategoryId: number | null; interestCategoryId: number | null; notes: string | null;
}
interface SplitRuleItem { id: number; categoryId: number | null; fixedAmount: number | null; label: string | null; sortOrder: number }
interface SplitRule { id: number; name: string; keyword: string; isActive: boolean; items: SplitRuleItem[] }

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditCell({ value, onSave, prefix = "" }: { value: number; onSave: (v: number) => void; prefix?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const n = parseFloat(draft);
    if (!isNaN(n)) onSave(n);
    setEditing(false);
  }

  if (editing) return (
    <input autoFocus type="number" value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
      className="w-24 rounded border border-ring bg-background px-2 py-0.5 text-xs text-right tabular-nums focus:outline-none" />
  );
  return (
    <span onClick={() => { setDraft(String(value)); setEditing(true); }}
      className="cursor-pointer tabular-nums hover:underline decoration-dotted text-xs">
      {prefix}{value.toLocaleString("en-IN")}
    </span>
  );
}

// ── Amortisation Table ────────────────────────────────────────────────────────

function AmortisationTable({ loan, categories }: { loan: Loan; categories: Category[] }) {
  const [rows, setRows] = useState<AmorRow[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ month: "", emi: 0, principal: 0, interest: 0, balance: 0 });

  useEffect(() => {
    fetch(`/api/loans/${loan.id}/schedule`)
      .then(r => r.json()).then((d: AmorRow[]) => setRows(d));
  }, [loan.id]);

  async function saveCell(row: AmorRow, field: keyof AmorRow, value: number) {
    const updated = { ...row, [field]: value };
    await fetch(`/api/loans/${loan.id}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: row.month, [field]: value }),
    });
    setRows(prev => prev.map(r => r.id === row.id ? updated : r));
  }

  async function addRow() {
    if (!newRow.month) return;
    try {
      const res = await fetch(`/api/loans/${loan.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });
      const data = await res.json() as AmorRow & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to add row");
      setRows(prev => [...prev, data].sort((a, b) => a.month.localeCompare(b.month)));
      setNewRow({ month: "", emi: 0, principal: 0, interest: 0, balance: 0 });
      setAdding(false);
      toast.success("Row added");
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function deleteRow(month: string) {
    await fetch(`/api/loans/${loan.id}/schedule`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    setRows(prev => prev.filter(r => r.month !== month));
  }

  const principalCat = categories.find(c => c.id === loan.principalCategoryId);
  const interestCat = categories.find(c => c.id === loan.interestCategoryId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{loan.keyword}</span>
          {principalCat && <Badge variant="outline" className="text-xs">Principal → {principalCat.name}</Badge>}
          {interestCat && <Badge variant="outline" className="text-xs">Interest → {interestCat.name}</Badge>}
        </div>
        <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {["Month", "EMI (₹)", "Principal (₹)", "Interest (₹)", "Balance (₹)", ""].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20 group">
                  <td className="px-3 py-2 font-mono">{row.month}</td>
                  <td className="px-3 py-2"><EditCell value={row.emi} onSave={v => saveCell(row, "emi", v)} /></td>
                  <td className="px-3 py-2"><EditCell value={row.principal} onSave={v => saveCell(row, "principal", v)} /></td>
                  <td className="px-3 py-2"><EditCell value={row.interest} onSave={v => saveCell(row, "interest", v)} /></td>
                  <td className="px-3 py-2"><EditCell value={row.balance ?? 0} onSave={v => saveCell(row, "balance", v)} /></td>
                  <td className="px-3 py-2">
                    <button onClick={() => deleteRow(row.month)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {adding && (
                <tr className="border-b border-border bg-muted/30">
                  <td className="px-3 py-1.5">
                    <input type="month" value={newRow.month}
                      onChange={e => setNewRow(r => ({ ...r, month: e.target.value }))}
                      className="w-32 rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none" />
                  </td>
                  {(["emi", "principal", "interest", "balance"] as const).map(f => (
                    <td key={f} className="px-3 py-1.5">
                      <input type="number" value={newRow[f]}
                        onChange={e => setNewRow(r => ({ ...r, [f]: parseFloat(e.target.value) || 0 }))}
                        className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs text-right focus:outline-none" />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 flex gap-1">
                    <button onClick={addRow} className="text-emerald-500 hover:text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setAdding(false)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!adding && (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Plus className="h-3 w-3" /> Add month
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Loan Modal ────────────────────────────────────────────────────────────

function AddLoanModal({ categories, onClose, onSaved }: { categories: Category[]; onClose: () => void; onSaved: (l: Loan) => void }) {
  const [form, setForm] = useState({ name: "", keyword: "", originalAmount: "", startDate: "", principalCategoryId: "", interestCategoryId: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.name || !form.keyword) { toast.error("Name and keyword required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/loans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, keyword: form.keyword.toLowerCase().replace(/\s+/g, ""),
          originalAmount: form.originalAmount ? Number(form.originalAmount) : null,
          startDate: form.startDate || null,
          principalCategoryId: form.principalCategoryId ? Number(form.principalCategoryId) : null,
          interestCategoryId: form.interestCategoryId ? Number(form.interestCategoryId) : null,
          notes: form.notes || null,
        }),
      });
      onSaved(await res.json() as Loan);
      toast.success("Loan added");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add Loan</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          {[{ l: "Loan name", k: "name", t: "text", ph: "LIC Housing Finance" }, { l: "Match keyword", k: "keyword", t: "text", ph: "lichousingfinance" }].map(({ l, k, t, ph }) => (
            <div key={k} className="space-y-1">
              <label className="text-xs text-muted-foreground">{l}</label>
              <input type={t} placeholder={ph} value={form[k as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Original amount (₹)</label>
              <input type="number" value={form.originalAmount} onChange={e => setForm(f => ({ ...f, originalAmount: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start date</label>
              <input type="month" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          {[{ l: "Principal → category", k: "principalCategoryId" }, { l: "Interest → category", k: "interestCategoryId" }].map(({ l, k }) => (
            <div key={k} className="space-y-1">
              <label className="text-xs text-muted-foreground">{l}</label>
              <select value={form[k as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="">— select —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          ))}
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

// ── Add Split Rule Modal ──────────────────────────────────────────────────────

function AddSplitRuleModal({ categories, onClose, onSaved }: { categories: Category[]; onClose: () => void; onSaved: (r: SplitRule) => void }) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<{ categoryId: string; fixedAmount: string; label: string }[]>([
    { categoryId: "", fixedAmount: "", label: "" },
    { categoryId: "", fixedAmount: "", label: "" },
    { categoryId: "", fixedAmount: "0", label: "Remainder" },
  ]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name || !keyword) { toast.error("Name and keyword required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/split-rules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, keyword: keyword.toLowerCase().replace(/\s+/g, ""),
          items: items.filter(i => i.categoryId).map(i => ({
            categoryId: Number(i.categoryId),
            fixedAmount: i.fixedAmount === "" || i.fixedAmount === "0" ? null : Number(i.fixedAmount),
            label: i.label,
          })),
        }),
      });
      onSaved(await res.json() as SplitRule);
      toast.success("Split rule added");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Add Fixed Split Rule</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Rule name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Parents transfer"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Match keyword</label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="accammageorgeeapen"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <p className="text-xs text-muted-foreground">Tip: paste the transaction description here — it will be normalised</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Split items</label>
              <button onClick={() => setItems(i => [...i, { categoryId: "", fixedAmount: "", label: "" }])}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" /> Add item
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Leave amount blank on the last item = remainder goes there</p>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_1fr_auto] gap-2 items-center">
                <input placeholder="Label" value={item.label} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
                <input type="number" placeholder="Amount" value={item.fixedAmount}
                  onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, fixedAmount: e.target.value } : x))}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-ring" />
                <select value={item.categoryId} onChange={e => setItems(it => it.map((x, i) => i === idx ? { ...x, categoryId: e.target.value } : x))}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                  <option value="">— category —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => setItems(it => it.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SplitsPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [rules, setRules] = useState<SplitRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);

  useEffect(() => {
    fetch("/api/loans").then(r => r.json()).then((d: Loan[]) => setLoans(d));
    fetch("/api/split-rules").then(r => r.json()).then((d: SplitRule[]) => setRules(d));
    fetch("/api/categories").then(r => r.json()).then((d: Category[]) => setCategories(d));
  }, []);

  async function deleteLoan(id: number) {
    await fetch("/api/loans", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLoans(prev => prev.filter(l => l.id !== id));
    toast.success("Loan removed");
  }

  async function deleteRule(id: number) {
    await fetch(`/api/split-rules/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
    toast.success("Rule removed");
  }

  return (
    <div className="space-y-8">
      {showAddLoan && <AddLoanModal categories={categories} onClose={() => setShowAddLoan(false)} onSaved={l => { setLoans(p => [...p, l]); setShowAddLoan(false); }} />}
      {showAddRule && <AddSplitRuleModal categories={categories} onClose={() => setShowAddRule(false)} onSaved={r => { setRules(p => [...p, r]); setShowAddRule(false); }} />}

      {/* Loan EMIs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Loan EMIs</h2>
            <p className="text-xs text-muted-foreground mt-0.5">EMI transactions are split into principal + interest using the amortisation schedule</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddLoan(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add loan
          </Button>
        </div>

        {loans.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No loans yet. Add one to start splitting EMI transactions.</CardContent></Card>
        ) : loans.map(loan => (
          <Card key={loan.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{loan.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {loan.originalAmount && <span className="text-xs text-muted-foreground">Loan: {fmt(loan.originalAmount)}</span>}
                  <button onClick={() => deleteLoan(loan.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <AmortisationTable loan={loan} categories={categories} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fixed Splits */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Fixed Splits</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Split a single transaction into multiple categories by fixed amounts</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAddRule(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No rules yet. Add one to split recurring transfers.</CardContent></Card>
        ) : rules.map(rule => (
          <Card key={rule.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">{rule.name}</CardTitle>
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{rule.keyword}</span>
                  {!rule.isActive && <Badge variant="secondary" className="text-xs">Paused</Badge>}
                </div>
                <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {(rule.items ?? []).map((item, i) => {
                const cat = categories.find(c => c.id === item.categoryId);
                return (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 text-muted-foreground/40">→</span>
                    <span className="font-medium text-foreground">{item.label ?? cat?.name ?? "—"}</span>
                    <span>{item.fixedAmount != null ? fmt(item.fixedAmount) : "remainder"}</span>
                    {cat && <Badge variant="outline" className="text-xs font-normal">{cat.name}</Badge>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
