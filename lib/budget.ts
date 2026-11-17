import { db } from "./db";
import { log } from "./log";

export function monthRange(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

export async function spentThisMonth(tool: string) {
  const { start, end } = monthRange();
  const agg = await db.costEntry.aggregate({
    where: { tool, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}

/** Automatischer Stopp: wirft, wenn die geschätzten Kosten das Monatslimit sprengen. */
export async function assertBudget(tool: string, estimatedEur: number) {
  const integ = await db.integration.findUnique({ where: { key: tool } });
  const limit = integ?.budgetMonthly ?? 0;
  if (!limit) return;
  const spent = await spentThisMonth(tool);
  if (spent + estimatedEur > limit) {
    await log("budget", `Gestoppt: ${tool} würde Limit überschreiten (${(spent + estimatedEur).toFixed(2)} € > ${limit} €)`, "WARN");
    throw new Error(
      `Budget-Stopp für ${tool}: bereits ${spent.toFixed(2)} € von ${limit} € verbraucht, geschätzt +${estimatedEur.toFixed(2)} €.`
    );
  }
  if (spent + estimatedEur > limit * 0.8) {
    await log("budget", `Warnung: ${tool} hat 80 % des Monatsbudgets erreicht`, "WARN");
  }
}

export async function recordCost(tool: string, amount: number, units: number, unitLabel: string, note?: string) {
  if (amount <= 0) return;
  await db.costEntry.create({ data: { tool, amount, units, unitLabel, note } });
}

export const usdToEur = (usd: number) => usd * Number(process.env.USD_EUR_RATE ?? 0.92);
