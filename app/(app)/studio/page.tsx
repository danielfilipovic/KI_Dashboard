import Link from "next/link";
import { db } from "@/lib/db";
import { setStage } from "@/app/studio-actions";
import { createOrder } from "@/app/studio-actions";
import { BriefFields } from "@/components/ClientForm";
import { Flash } from "@/components/Flash";
import { STAGES, STAGE_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MANUAL = ["BRIEFING", "SKRIPT", "GENERIERUNG", "SCHNITT"];

export default async function Studio({ searchParams }: { searchParams: Promise<{ client?: string; ok?: string; error?: string; alle?: string }> }) {
  const sp = await searchParams;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [orders, clients] = await Promise.all([
    db.order.findMany({
      where: {
        ...(sp.client ? { clientId: sp.client } : {}),
        ...(sp.alle ? {} : { OR: [{ stage: { not: "AUSGELIEFERT" } }, { deliveredAt: { gte: since } }] }),
      },
      include: { client: true, _count: { select: { assets: true } } },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    }),
    db.client.findMany({ where: { status: "AKTIV" }, orderBy: { name: "asc" } }),
  ]);
  const today = new Date();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>Marketing-Studio</h1>
          <p className="text-sm text-slate-500">Briefing → Skript → Generierung → Schnitt → interne Freigabe → Kundenfreigabe → ausgeliefert</p>
        </div>
        <form className="flex gap-2">
          <select name="client" defaultValue={sp.client ?? ""} className="input w-48" aria-label="Kunde filtern">
            <option value="">Alle Kunden</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-ghost">Filtern</button>
        </form>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const col = orders.filter((o) => o.stage === s);
          return (
            <section key={s} className="w-60 shrink-0 space-y-2 rounded-xl bg-slate-100 p-2">
              <h2 className="px-1 text-sm">{STAGE_LABEL[s]} <span className="text-slate-400">({col.length})</span></h2>
              {col.map((o) => {
                const late = o.dueAt && o.dueAt < today && o.stage !== "AUSGELIEFERT";
                return (
                  <article key={o.id} className="card space-y-1 p-3">
                    <Link href={`/studio/${o.id}`} className="block font-medium leading-tight hover:underline">{o.title}</Link>
                    <p className="text-xs text-slate-500">{o.client.name} · {o.format} · {o._count.assets} Dateien</p>
                    {o.dueAt && <p className={`text-xs ${late ? "font-medium text-rose-700" : "text-slate-500"}`}>fällig {o.dueAt.toLocaleDateString("de-AT")}{late ? " – überfällig" : ""}</p>}
                    {MANUAL.includes(s) && (
                      <form action={setStage} className="flex gap-1 pt-1">
                        <input type="hidden" name="id" value={o.id} /><input type="hidden" name="from" value="/studio" />
                        <select name="stage" defaultValue={o.stage} className="input py-1 text-xs" aria-label="Phase">
                          {MANUAL.map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
                        </select>
                        <button className="btn-ghost px-2 py-1 text-xs">OK</button>
                      </form>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Ausgelieferte Aufträge der letzten 30 Tage. <Link className="underline" href={`/studio?alle=1${sp.client ? `&client=${sp.client}` : ""}`}>Alle anzeigen</Link></p>

      {clients.length > 0 ? (
        <details className="card">
          <summary className="cursor-pointer font-medium">+ Neuer Auftrag</summary>
          <form action={createOrder} className="mt-3 space-y-3">
            <div><label className="label">Kunde</label>
              <select name="clientId" className="input" required>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <BriefFields o={{ platform: "Instagram", durationSec: 20 }} />
            <button className="btn-primary">Auftrag anlegen</button>
          </form>
        </details>
      ) : (
        <p className="card text-sm text-slate-500">Lege zuerst einen <Link href="/kunden" className="text-indigo-600">Kunden</Link> an.</p>
      )}
    </>
  );
}
