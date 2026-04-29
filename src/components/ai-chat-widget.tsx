"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, RefreshCw, User, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "How much have I spent this month?",
  "What if I spent ₹10K on a trip?",
  "When is my next SIP?",
  "How much LTGS exemption is left?",
];

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, open, minimised]);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setMinimised(false);

    // Add an empty assistant message to stream into
    setMessages(m => [...m, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        let errMsg = "AI request failed.";
        try {
          const data = await res.json() as { error?: string };
          errMsg = data.error ?? errMsg;
        } catch { /* ignore parse error */ }
        setMessages(m => m.slice(0, -1).concat({ role: "assistant", content: `⚠️ ${errMsg}` }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages(m => {
          const last = m[m.length - 1];
          if (last?.role !== "assistant") return m;
          return [...m.slice(0, -1), { role: "assistant", content: last.content + chunk }];
        });
      }
    } catch {
      setMessages(m => m.slice(0, -1).concat({ role: "assistant", content: "⚠️ Could not reach Ollama. Make sure it's running: `ollama serve`" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div className={cn(
          "fixed bottom-20 right-5 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200",
          minimised ? "h-12 overflow-hidden" : "h-[480px] flex flex-col"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium flex-1">Pacey</span>
            <button onClick={() => setMinimised(m => !m)} className="text-muted-foreground hover:text-foreground">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { setOpen(false); setMinimised(false); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="space-y-3 pt-1">
                    <p className="text-xs text-muted-foreground text-center">Ask anything about your finances</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => send(s)}
                          className="rounded-xl border border-border px-3 py-2 text-[11px] text-left text-muted-foreground hover:border-foreground hover:text-foreground transition-colors leading-snug">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((m, i) => (
                      <div key={i} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                        {m.role === "assistant" && (
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Sparkles className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
                          m.role === "user"
                            ? "bg-foreground text-background rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        )}>
                          {m.content}
                        </div>
                        {m.role === "user" && (
                          <div className="h-5 w-5 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-3 w-3 text-background" />
                          </div>
                        )}
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-2">
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <Sparkles className="h-3 w-3 text-muted-foreground animate-pulse" />
                        </div>
                        <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="Ask about your finances…"
                    className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    disabled={loading}
                  />
                  <button
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    className="rounded-xl bg-foreground text-background w-8 h-8 flex items-center justify-center disabled:opacity-40 hover:opacity-80 transition-opacity shrink-0"
                  >
                    {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setOpen(o => !o); setMinimised(false); }}
        className={cn(
          "fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200",
          open ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-foreground text-background hover:opacity-80"
        )}
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
        {loading && (
          <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
        )}
      </button>
    </>
  );
}
