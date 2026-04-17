"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Check, X, Camera, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: number;
  name: string;
  type: string;
  currentValue: number;
  notes: string | null;
  updatedAt: string | null;
}

interface NetWorthSnapshot {
  month: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface NetWorthData {
  assets: Asset[];
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  snapshots: NetWorthSnapshot[];
  currentMonth: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

const ASSET_TYPES = [
  { value: "bank",       label: "Bank / Savings",   color: "bg-blue-500" },
  { value: "investment", label: "Investments",       color: "bg-emerald-500" },
  { value: "property",   label: "Property",          color: "bg-amber-500" },
  { value: "epf",        label: "EPF / PF",          color: "bg-purple-500" },
  { value: "other",      label: "Other",             color: "bg-muted-foreground" },
];

function typeLabel(t: string) {
  return ASSET_TYPES.find(a => a.value === t)?.label ?? t;
}
function typeColor(t: string) {
  return ASSET_TYPES.find(a => a.value === t)?.color ?? "bg-muted-foreground";
}

// ─── Inline editable value ────────────────────────────────────────────────────

function EditableValue({ value, onSave }: { value: number; onSave: (v: number) => Promise<void> }) {
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

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">₹</span>
        <input
          ref={inputRef}
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(String(value)); setEditing(false); } }}
          className="w-32 rounded border border-ring bg-background px-2 py-0.5 text-sm text-right tabular-nums focus:outline-none"
          disabled={saving}
        />
        <button onClick={commit} disabled={saving} className="text-emerald-500 hover:text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
        <button onClick={() => { setDraft(String(value)); setEditing(false); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 group/val cursor-pointer" onClick={() => setEditing(true)}>
      <span className="text-sm font-semibold tabular-nums">{fmt(value)}</span>
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/val:opacity-100 transition-opacity" />
    </div>
  );
}

// ─── Add Asset Form ───────────────────────────────────────────────────────────

function AddAssetForm({ onAdd }: { onAdd: (asset: Asset) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("bank");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim() || !value) return;
    setSaving(true);
    try {
      const res = await fetch("/api/net-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type, currentValue: Number(value) }),
      });
      const created = await res.json() as Asset;
      onAdd(created);
      setName(""); setValue(""); setType("bank"); setOpen(false);
      toast.success("Asset added");
    } catch {
      toast.error("Failed to add asset");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />Add asset
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <p className="text-sm font-medium">New asset</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Name (e.g. HDFC Savings)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          type="number"
          placeholder="Current value (₹)"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} disabled={saving || !name.trim() || !value}>Save</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  useEffect(() => {
    fetch("/api/net-worth")
      .then(r => r.json())
      .then((d: NetWorthData) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function updateAsset(id: number, currentValue: number) {
    const res = await fetch("/api/net-worth", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, currentValue }),
    });
    if (!res.ok) { toast.error("Failed to update"); throw new Error(); }
    const updated = await res.json() as Asset;
    toast.success("Updated");
    setData(prev => prev ? { ...prev, assets: prev.assets.map(a => a.id === id ? updated : a), totalAssets: prev.assets.map(a => a.id === id ? updated : a).reduce((s, a) => s + a.currentValue, 0), netWorth: prev.assets.map(a => a.id === id ? updated : a).reduce((s, a) => s + a.currentValue, 0) - prev.totalLiabilities } : prev);
  }

  async function deleteAsset(id: number) {
    const res = await fetch(`/api/net-worth?id=${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete"); return; }
    toast.success("Asset removed");
    setData(prev => {
      if (!prev) return prev;
      const updated = prev.assets.filter(a => a.id !== id);
      const totalAssets = updated.reduce((s, a) => s + a.currentValue, 0);
      return { ...prev, assets: updated, totalAssets, netWorth: totalAssets - prev.totalLiabilities };
    });
  }

  async function saveSnapshot() {
    setSnapshotting(true);
    try {
      const res = await fetch("/api/net-worth/snapshot", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("Snapshot saved for " + data?.currentMonth);
      // Reload to pick up new snapshot
      const refreshed = await fetch("/api/net-worth").then(r => r.json()) as NetWorthData;
      setData(refreshed);
    } catch {
      toast.error("Failed to save snapshot");
    } finally {
      setSnapshotting(false);
    }
  }

  if (loading) return (
    <div className="space-y-4">
      {[0, 1, 2].map(i => <Card key={i}><CardContent className="pt-5 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-48" /></CardContent></Card>)}
    </div>
  );
  if (!data) return <p className="text-muted-foreground text-sm">Failed to load.</p>;

  // Group assets by type
  const byType = ASSET_TYPES.reduce<Record<string, Asset[]>>((acc, t) => {
    acc[t.value] = data.assets.filter(a => a.type === t.value);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Net Worth</p>
            <p className={cn("text-2xl font-semibold tabular-nums", data.netWorth < 0 ? "text-destructive" : "text-foreground")}>
              {fmt(data.netWorth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
            <p className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {fmt(data.totalAssets)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground mb-1">Liabilities</p>
            <p className="text-2xl font-semibold tabular-nums text-destructive">
              {fmt(data.totalLiabilities)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">home loan balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Assets */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Assets</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline"
                onClick={saveSnapshot}
                disabled={snapshotting}
                className="gap-1.5 text-xs"
              >
                <Camera className="h-3.5 w-3.5" />
                {snapshotting ? "Saving…" : "Save snapshot"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {ASSET_TYPES.map(t => {
            const items = byType[t.value];
            if (items.length === 0) return null;
            const total = items.reduce((s, a) => s + a.currentValue, 0);
            return (
              <div key={t.value}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", t.color)} />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmt(total)}</span>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  {items.map((asset, i) => (
                    <div key={asset.id} className={cn(
                      "flex items-center gap-3 px-3 py-2.5",
                      i < items.length - 1 && "border-b border-border"
                    )}>
                      <span className="flex-1 text-sm">{asset.name}</span>
                      <EditableValue
                        value={asset.currentValue}
                        onSave={v => updateAsset(asset.id, v)}
                      />
                      <button
                        onClick={() => deleteAsset(asset.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <AddAssetForm onAdd={asset => setData(prev => prev ? { ...prev, assets: [...prev.assets, asset], totalAssets: prev.totalAssets + asset.currentValue, netWorth: prev.netWorth + asset.currentValue } : prev)} />
        </CardContent>
      </Card>

      {/* History */}
      {data.snapshots.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">History</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="rounded-xl border border-border overflow-hidden">
              {data.snapshots.map((snap, i) => (
                <div key={snap.month} className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm",
                  i < data.snapshots.length - 1 && "border-b border-border"
                )}>
                  <span className="text-muted-foreground w-20 shrink-0">{snap.month}</span>
                  <span className="flex-1 tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(snap.totalAssets)}</span>
                  <span className="tabular-nums text-destructive shrink-0">−{fmt(snap.totalLiabilities)}</span>
                  <span className={cn("tabular-nums font-semibold w-28 text-right shrink-0", snap.netWorth < 0 ? "text-destructive" : "text-foreground")}>
                    {fmt(snap.netWorth)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
