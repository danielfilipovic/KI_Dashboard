import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addCost, addRevenue } from "@/app/actions";
import { monthRange } from "@/lib/budget";
import { Flash } from "@/components/Flash";
import { eur } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Finanzen({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser(["OWNER"]);
  const sp = await searchParams;
  const now = new Date();
  const rows = await Promise.all(
    Array.from({ length: 6 }, async (_, i) => {
      const { start, end } = monthRange(new Date(now.getFullYear(), now.getMonth() - i, 15));
      const [svc, prod, cost, won] = await Promise.all([
        db.revenue.aggregate({ where: { date: { gte: start, lt: end }, stream: "SERVICE" }, _sum: { amount: true } }),
        db.revenue.aggregate({ where: { date: { gte: start, lt: end }, stream: "PRODUCT" }, _sum: { amount: true } }),
        db.costEntry.aggregate({ where: { date: { gte: start, lt: end } }, _sum: { amount: true } }),
        db.leadEvent.count({ where: { createdAt: { gte: start, lt: end }, text: "Status → KUNDE" } }),
      ]);
      const s = svc._sum.amount ?? 0, p = prod._sum.amount ?? 0, c = cost._sum.amount ?? 0;
      return { month: start.toLocaleDateString("de-AT", { month: "long", year: "numeric" }), s, p, c, won, margin: s + p - c };
    })
  );
  const byTool = await db.costEntry.groupBy({ by: ["tool"], where: { date: { gte: monthRange().start } }, _sum: { amount: true } });
  const cur = rows[0];
  const cac = cur.won ? cur.c / cur.won : null;
  const delivered = await db.order.aggregate({ where: { deliveredAt: { gte: monthRange().start } }, _avg: { minutesSpent: true }, _count: true });
  const mrr = (await db.client.aggregate({ where: { status: "AKTIV" }, _sum: { monthlyFee: true } }))._sum.monthlyFee ?? 0;
  const assetCost = await db.asset.aggregate({ where: { createdAt: { gte: monthRange().start }, costEur: { gt: 0 } }, _avg: { costEur: true }, _count: true });
  const clients = await db.client.findMany({ where: { status: "AKTIV" }, orderBy: { name: "asc" } });
  const fixedMonthly = (await db.costEntry.aggregate({ where: { fixed: true, date: { gte: monthRange().start } }, _sum: { amount: true } }))._sum.amount ?? 0;

  return (
    <>
      <h1>Finanzen &amp; Kosten</h1>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card"><p className="label">Umsatz Monat</p><p className="text-2xl font-semibold">{eur(cur.s + cur.p)}</p></div>
        <div className="card"><p className="label">Kosten Monat</p><p className="text-2xl font-semibold">{eur(cur.c)}</p></div>
        <div className="card"><p className="label">Deckungsbeitrag</p><p className="text-2xl font-semibold">{eur(cur.margin)}</p></div>
        <div className="card"><p className="label">Tool-Kosten / Neukunde</p><p className="text-2xl font-semibold">{cac === null ? "–" : eur(cac)}</p><p className="text-xs text-slate-500">vereinfachter CAC ohne Zeitaufwand</p></div>
      </section>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="card"><p className="label">MRR (aktive Kunden)</p><p className="text-2xl font-semibold">{eur(mrr)}</p></div>
        <div className="card"><p className="label">Produktionszeit / Video</p><p className="text-2xl font-semibold">{delivered._count ? `${Math.round(delivered._avg.minutesSpent ?? 0)} min` : "–"}</p><p className="text-xs text-slate-500">{delivered._count} ausgeliefert diesen Monat</p></div>
        <div className="card"><p className="label">Ø Kosten pro KI-Asset</p><p className="text-2xl font-semibold">{assetCost._count ? eur(assetCost._avg.costEur ?? 0) : "–"}</p><p className="text-xs text-slate-500">{assetCost._count} Assets mit Kosten</p></div>
      </section>
      <p className="text-sm text-slate-500">Break-even der Fixkosten: {eur(fixedMonthly)} im Monat. Bei einem Starter-Paket zu 390 € sind das {fixedMonthly ? (fixedMonthly / 390).toFixed(2) : "0"} Kunden.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <form action={addRevenue} className="card space-y-2">
          <h2>Umsatz erfassen</h2>
          <div className="grid grid-cols-2 gap-2">
            <input name="amount" type="number" step="0.01" placeholder="Netto €" className="input" required />
            <input name="date" type="date" className="input" defaultValue={now.toISOString().slice(0, 10)} />
            <select name="stream" className="input"><option value="SERVICE">Dienstleistung</option><option value="PRODUCT">Digitales Produkt</option></select>
            <input name="note" placeholder="Notiz / Rechnungsnr." className="input" />
            <select name="clientId" className="input col-span-2" aria-label="Kunde"><option value="">– Kunde (optional) –</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <button className="btn-primary">Speichern</button>
        </form>
        <form action={addCost} className="card space-y-2">
          <h2>Fixkosten / Abo erfassen</h2>
          <div className="grid grid-cols-2 gap-2">
            <input name="tool" placeholder="Tool, z. B. higgsfield" className="input" required />
            <input name="amount" type="number" step="0.01" placeholder="€" className="input" required />
            <input name="date" type="date" className="input" defaultValue={now.toISOString().slice(0, 10)} />
            <input name="note" placeholder="Notiz" className="input" />
          </div>
          <button className="btn-primary">Speichern</button>
          <p className="text-xs text-slate-500">Nutzungsbasierte Kosten (Apify, Claude) bucht die App automatisch.</p>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card overflow-x-auto p-0 lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="p-3">Monat</th><th className="p-3 text-right">Dienstl.</th><th className="p-3 text-right">Produkte</th><th className="p-3 text-right">Kosten</th><th className="p-3 text-right">Ergebnis</th><th className="p-3 text-right">Neukunden</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.month}><td className="p-3">{r.month}</td><td className="p-3 text-right">{eur(r.s)}</td><td className="p-3 text-right">{eur(r.p)}</td><td className="p-3 text-right">{eur(r.c)}</td><td className={`p-3 text-right font-medium ${r.margin < 0 ? "text-rose-700" : ""}`}>{eur(r.margin)}</td><td className="p-3 text-right">{r.won}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 className="mb-2">Kosten je Tool (Monat)</h2>
          <ul className="space-y-1 text-sm">
            {byTool.map((t) => <li key={t.tool} className="flex justify-between"><span>{t.tool}</span><span>{eur(t._sum.amount ?? 0)}</span></li>)}
            {byTool.length === 0 && <li className="text-slate-500">Noch keine Kosten.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
