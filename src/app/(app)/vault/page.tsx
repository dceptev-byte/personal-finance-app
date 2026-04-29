"use client";

import { useEffect, useState } from "react";
import { Lock, Eye, EyeOff, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VaultMeta { id: number; title: string; category: string; reminderDate: string | null; reminderNote: string | null; updatedAt: string | null }
interface VaultDecrypted { title: string; category: string; fields: { key: string; value: string }[]; notes?: string; reminderDate: string | null; reminderNote: string | null }

const CATEGORIES = ["insurance", "bank", "investment", "general"] as const;

function CategoryBadge({ cat }: { cat: string }) {
  const colors: Record<string, string> = {
    insurance: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    bank: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    investment: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    general: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", colors[cat] ?? colors.general)}>{cat}</span>;
}

function VaultEntryView({ id, onClose }: { id: number; onClose: () => void }) {
  const [data, setData] = useState<VaultDecrypted | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`/api/vault/${id}`).then(r => r.json()).then((d: VaultDecrypted) => setData(d));
  }, [id]);

  if (!data) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md">
        <p className="text-sm text-muted-foreground animate-pulse">Decrypting…</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">{data.title}</h2>
            <CategoryBadge cat={data.category} />
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="space-y-2">
          {data.fields.map((f, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <span className="text-xs text-muted-foreground w-28 shrink-0">{f.key}</span>
              <div className="flex items-center gap-2 flex-1 justify-end">
                <span className="text-sm font-mono tabular-nums">
                  {revealed[f.key] ? f.value : "•".repeat(Math.min(f.value.length, 12))}
                </span>
                <button
                  onClick={() => setRevealed(r => ({ ...r, [f.key]: !r[f.key] }))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {revealed[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
        {data.notes && <p className="text-xs text-muted-foreground border-t border-border pt-3">{data.notes}</p>}
        {data.reminderNote && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{data.reminderNote}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">All data is AES-256 encrypted at rest.</p>
      </div>
    </div>
  );
}

function AddModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", category: "general", reminderNote: "" });
  const [fields, setFields] = useState([{ key: "", value: "" }]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title || fields.some(f => !f.key)) return;
    setSaving(true);
    try {
      await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, fields, reminderNote: form.reminderNote || undefined }),
      });
      toast.success("Entry saved to vault");
      onSaved();
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="rounded-2xl border border-border bg-card p-6 w-full max-w-md space-y-4 shadow-xl">
        <h2 className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> New vault entry</h2>
        <div className="space-y-3">
          <input placeholder="Title (e.g. HDFC ERGO)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Fields</p>
            {fields.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input placeholder="Field name" value={f.key} onChange={e => setFields(fs => fs.map((fi, j) => j === i ? { ...fi, key: e.target.value } : fi))}
                  className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
                <input placeholder="Value" value={f.value} onChange={e => setFields(fs => fs.map((fi, j) => j === i ? { ...fi, value: e.target.value } : fi))}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
            <button onClick={() => setFields(f => [...f, { key: "", value: "" }])} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add field
            </button>
          </div>
          <input placeholder="Reminder / note (optional)" value={form.reminderNote} onChange={e => setForm(f => ({ ...f, reminderNote: e.target.value }))}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save} disabled={saving}>Save encrypted</Button>
        </div>
      </div>
    </div>
  );
}

export default function VaultPage() {
  const [entries, setEntries] = useState<VaultMeta[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch("/api/vault");
    setEntries(await res.json() as VaultMeta[]);
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function del(id: number) {
    await fetch(`/api/vault/${id}`, { method: "DELETE" });
    setEntries(e => e.filter(x => x.id !== id));
    toast.success("Entry deleted");
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = entries.filter(e => e.category === cat);
    return acc;
  }, {} as Record<string, VaultMeta[]>);

  return (
    <div className="space-y-6">
      {viewing !== null && <VaultEntryView id={viewing} onClose={() => setViewing(null)} />}
      {adding && <AddModal onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>All entries encrypted with AES-256-GCM</span>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5 mr-1" />Add entry</Button>
      </div>

      {CATEGORIES.map(cat => grouped[cat].length > 0 && (
        <Card key={cat}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold capitalize">{cat}</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {grouped[cat].map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-3 border-b border-border last:border-0 group">
                <div className="flex items-center gap-3">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{entry.title}</p>
                    {entry.reminderNote && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="h-3 w-3" />{entry.reminderNote.slice(0, 50)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={() => setViewing(entry.id)} className="h-7 px-2 text-xs">
                    <Eye className="h-3.5 w-3.5 mr-1" />View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => del(entry.id)} className="h-7 px-2 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Lock className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Vault is empty</p>
          <p className="text-xs text-muted-foreground mt-1">Add policy numbers, account refs, login hints — all encrypted</p>
        </div>
      )}
    </div>
  );
}
