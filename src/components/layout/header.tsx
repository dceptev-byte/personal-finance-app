"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const pageTitles: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/expenses":    "Expenses",
  "/investments": "Investments",
  "/tax":         "Tax",
  "/vault":       "Vault",
  "/ai":          "AI Assistant",
  "/admin":       "Admin",
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] ?? "Fast Pace";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <div>
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(), "EEEE, d MMMM yyyy")}
        </p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
    </header>
  );
}
