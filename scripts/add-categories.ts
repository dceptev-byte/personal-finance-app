import { db } from "../src/db/index";
import { categories } from "../src/db/schema";

async function main() {
  const newCats = [
    { name: "Savings/ER", color: "#10b981", icon: "piggy-bank" },
    { name: "Investments", color: "#6366f1", icon: "trending-up" },
    { name: "Income", color: "#22c55e", icon: "arrow-down-circle" },
    { name: "EMI Principal", color: "#f59e0b", icon: "home" },
    { name: "EMI Interest", color: "#ef4444", icon: "percent" },
  ];
  for (const cat of newCats) {
    await db.insert(categories).values(cat).onConflictDoNothing();
    console.log("Added:", cat.name);
  }
  process.exit(0);
}

main().catch(console.error);
