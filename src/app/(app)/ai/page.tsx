"use client";

import { useEffect, useRef, useState } from "react";
import { Send, RefreshCw, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Message { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "How much have I spent this month vs budget?",
  "What if I spent ₹10K on a weekend trip?",
  "When is my next SIP and how much?",
  "How much LTGS exemption do I have left?",
  "Project my portfolio in 10 years at current SIP",
  "Which budget category am I closest to breaching?",
];

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const content = text ?? input.trim();
    if (!content || loading) return;
    setInput("");
    const userMsg: Message = { role: "user", content };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    setMessages(m => [...m, { role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        setMessages(m => m.slice(0, -1).concat({ role: "assistant", content: "AI request failed. Is Ollama running?" }));
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
      setMessages(m => m.slice(0, -1).concat({ role: "assistant", content: "Could not reach Ollama. Is it running?" }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center space-y-1">
              <Sparkles className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium">Ask anything about your finances</p>
              <p className="text-xs text-muted-foreground">Powered by {process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? "local AI"} · runs entirely on your machine</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-xl border border-border px-4 py-3 text-xs text-left text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={cn("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "assistant" && (
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-foreground text-background rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}>
                  {m.content}
                </div>
                {m.role === "user" && (
                  <div className="h-6 w-6 rounded-full bg-foreground flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-3.5 w-3.5 text-background" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
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
      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="Ask about your finances…"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            disabled={loading}
          />
          <Button onClick={() => send()} disabled={loading || !input.trim()} className="rounded-xl">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          All conversations stay on your machine · Never sent to the cloud
        </p>
      </div>
    </div>
  );
}
