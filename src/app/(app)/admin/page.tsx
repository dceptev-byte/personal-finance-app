"use client";

import { useEffect, useState } from "react";
import { Database, Cpu, HardDrive, RefreshCw, CheckCircle2, XCircle, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminData {
  db: {
    path: string;
    sizeMb: string | null;
    counts: {
      transactions: number;
      categories: number;
      investments: number;
      vaultEntries: number;
      learnedMappings: number;
    };
  };
  ollama: {
    ok: boolean;
    model?: string;
    error?: string;
  };
  backup: {
    dest: string;
    ssdMounted: boolean;
    lastBackup: string | null;
  };
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

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
      if (result.ok) {
        toast.success(result.message ?? "Backup complete");
        load();
      } else {
        toast.error(result.error ?? "Backup failed");
      }
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
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 max-w-2xl">

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
            <span className={cn(
              "ml-auto flex items-center gap-1.5 text-xs font-normal",
              data.ollama.ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
            )}>
              {data.ollama.ok
                ? <><CheckCircle2 className="h-3.5 w-3.5" />Connected</>
                : <><XCircle className="h-3.5 w-3.5" />Offline</>
              }
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <StatRow label="Status" value={data.ollama.ok ? "Running" : "Not reachable"} />
          <StatRow label="Model" value={data.ollama.model ?? "—"} />
          <StatRow label="Endpoint" value="localhost:11434" />
          {data.ollama.error && (
            <p className="text-xs text-destructive mt-2">{data.ollama.error}</p>
          )}
        </CardContent>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground" />
            Backup
            <Badge
              variant="outline"
              className={cn(
                "ml-auto text-xs",
                data.backup.ssdMounted
                  ? "border-emerald-500/50 text-emerald-600 dark:text-emerald-400"
                  : "border-destructive/50 text-destructive"
              )}
            >
              {data.backup.ssdMounted ? "SSD mounted" : "SSD not found"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div>
            <StatRow label="Destination" value={data.backup.dest || "Not configured"} />
            <StatRow
              label="Last backup"
              value={data.backup.lastBackup
                ? data.backup.lastBackup.replace("finance_", "").replace(".db", "")
                : "None yet"}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runBackup}
            disabled={backingUp || !data.backup.ssdMounted}
            className="w-full"
          >
            {backingUp
              ? <><RefreshCw className="h-3.5 w-3.5 mr-2 animate-spin" />Backing up…</>
              : <><Play className="h-3.5 w-3.5 mr-2" />Run backup now</>
            }
          </Button>
          {!data.backup.ssdMounted && (
            <p className="text-xs text-muted-foreground text-center">Mount your SSD to enable backup</p>
          )}
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
