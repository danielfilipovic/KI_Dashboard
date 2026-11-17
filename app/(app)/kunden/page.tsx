import Link from "next/link";
import { db } from "@/lib/db";
import { createClient } from "@/app/studio-actions";
import { ClientFields } from "@/components/ClientForm";
import { Flash } from "@/components/Flash";
import { PACKAGES, eur } from "@/lib/constants";
import { monthRange } from "@/lib/budget";

export const dynamic = "force-dynamic";

export default async function Kunden({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const { start, end } = monthRange();
  const clients = await db.client.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { orders: { where: { OR: [{ dueAt: { gte: start, lt: end } }, { createdAt: { gte: start, lt: end } }] }, select: { stage: true } } },
  });
  const mrr = clients.filter((c) => c.status === "AKTIV").reduce((a, c) => a + c.monthlyFee, 0);
  return (
    <>
      <div><h1>Kunden</h1><p className="text-sm text-slate-500">{clients.filter((c) => c.status === "AKTIV").length} aktiv · MRR {eur(mrr)}</p></div>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => {
          const done = c.orders.filter((o) => o.stage === "AUSGELIEFERT").length;
          return (
            <Link key={c.id} href={`/kunden/${c.id}`} className="card block space-y-2 hover:border-indigo-300">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{c.name}</p>
                <span className={`badge ${c.status === "AKTIV" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{c.status}</span>
              </div>
              <p className="text-xs text-slate-500">{c.industry ?? "–"} · {PACKAGES[c.package]?.label} · {eur(c.monthlyFee)}/Monat</p>
              <div className="text-xs">Kontingent diesen Monat: <b>{done}</b> ausgeliefert / {c.orders.length} geplant / {c.videosPerMonth} vereinbart</div>
              <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (done / Math.max(1, c.videosPerMonth)) * 100)}%` }} /></div>
            </Link>
          );
        })}
        {clients.length === 0 && <p className="card text-sm text-slate-500">Noch keine Kunden. Tipp: Im CRM bei einem Lead „Als Kunde anlegen“ wählen.</p>}
      </section>
      <details className="card">
        <summary className="cursor-pointer font-medium">+ Kunde ohne Lead anlegen</summary>
        <form action={createClient} className="mt-3 space-y-3"><ClientFields /><button className="btn-primary">Anlegen</button></form>
      </details>
    </>
  );
}
