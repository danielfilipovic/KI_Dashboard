import Link from "next/link";
import { db } from "@/lib/db";
import { monthRange } from "@/lib/budget";
import { getSecret, type IntegrationKey } from "@/lib/integrations";
import { ApprovalCard } from "@/components/ApprovalCard";
import { BarChart } from "@/components/BarChart";
import { Flash } from "@/components/Flash";
import { STATUSES, STATUS_LABEL, dt, eur } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function sumRevenue(start: Date, end: Date) {
  return (await db.revenue.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amount: true } }))._sum.amount ?? 0;
}
async function sumCost(start: Date, end: Date) {
  return (await db.costEntry.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amount: true } }))._sum.amount ?? 0;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const { start, end } = monthRange(now);
  const prev = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 15));
  const lastYear = monthRange(new Date(now.getFullYear() - 1, now.getMonth(), 15));

  const [rev, revPrev, revLY, cost, byStatus, approvals, logs, integrations] = await Promise.all([
    sumRevenue(start, end), sumRevenue(prev.start, prev.end), sumRevenue(lastYear.start, lastYear.end), sumCost(start, end),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.approval.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5 }),
    db.logEntry.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.integration.findMany(),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const openLeads = ["NEU", "KONTAKTIERT", "TERMIN", "ANGEBOT"].reduce((a, s) => a + count(s), 0);
  const activeClients = count("KUNDE") + count("UPSELL");

  const months = await Promise.all(
    Array.from({ length: 6 }, (_, i) => {
      const r = monthRange(new Date(now.getFullYear(), now.getMonth() - 5 + i, 15));
      return sumRevenue(r.start, r.end).then((v) => ({ label: r.start.toLocaleDateString("de-AT", { month: "short" }), value: v }));
    })
  );
  const funnel = STATUSES.filter((s) => s !== "VERLOREN").map((s) => ({ label: STATUS_LABEL[s], value: count(s) }));
  const demoFor: string[] = [];
  for (const i of integrations) if (!(await getSecret(i.key as IntegrationKey))) demoFor.push(i.label);

  const kpis = [
    { label: "Umsatz Monat", value: eur(rev), sub: `Vormonat ${eur(revPrev)} · Vorjahr ${eur(revLY)}` },
    { label: "Offene Leads", value: String(openLeads), sub: `${count("NEU")} neu, ${count("ANGEBOT")} im Angebot` },
    { label: "Aktive Kunden", value: String(activeClients), sub: `${count("UPSELL")} mit Upsell` },
    { label: "Tool-Kosten Monat", value: eur(cost), sub: rev > 0 ? `${((cost / rev) * 100).toFixed(1)} % vom Umsatz` : "noch kein Umsatz" },
    { label: "Geplante Posts", value: "–", sub: "ab Phase 2" },
    { label: "Verkaufte Produkte", value: "–", sub: "ab Phase 2" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1>Übersicht</h1>
          <p className="text-sm text-slate-500">{now.toLocaleDateString("de-AT", { dateStyle: "full" })}</p>
        </div>
        <Link href="/leads" className="btn-primary">+ Leads suchen</Link>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      {demoFor.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Demo-Modus (Beispieldaten, keine Kosten) für: {demoFor.join(", ")}. Schlüssel unter <Link className="underline" href="/einstellungen">Einstellungen</Link> hinterlegen.
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <p className="label">{k.label}</p>
            <p className="text-2xl font-semibold">{k.value}</p>
            <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2>Wartet auf deine Freigabe</h2>
            <Link href="/freigaben" className="text-sm text-indigo-600">alle →</Link>
          </div>
          {approvals.length === 0 && <p className="card text-sm text-slate-500">Nichts offen. 🎉</p>}
          {approvals.map((a) => <ApprovalCard key={a.id} a={a} from="/" compact />)}
        </div>
        <div className="space-y-3">
          <h2>Aktivität</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {logs.length === 0 && <li className="p-4 text-sm text-slate-500">Noch keine Aktivität.</li>}
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3 p-3 text-sm">
                <span className={`badge h-fit ${l.level === "ERROR" ? "bg-rose-100 text-rose-700" : l.level === "WARN" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{l.source}</span>
                <span className="flex-1">{l.message}</span>
                <time className="shrink-0 text-xs text-slate-400">{dt(l.createdAt)}</time>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h2 className="mb-4">Umsatz (6 Monate)</h2><BarChart data={months} format={eur} label="Umsatz pro Monat" /></div>
        <div className="card"><h2 className="mb-4">Akquise-Funnel (Anzahl Leads)</h2><BarChart data={funnel} format={(n) => String(n)} label="Leads pro Pipeline-Stufe" /></div>
      </section>
    </>
  );
}
