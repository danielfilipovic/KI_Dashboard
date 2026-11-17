import Link from "next/link";
import { db } from "@/lib/db";
import { setLeadStatus } from "@/app/actions";
import { STATUSES, STATUS_LABEL, eur } from "@/lib/constants";
import { scoreColor } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export default async function CrmPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const leads = await db.lead.findMany({
    where: q ? { OR: [{ name: { contains: q } }, { category: { contains: q } }, { district: { contains: q } }] } : undefined,
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
  });
  const pipelineValue = leads.filter((l) => ["TERMIN", "ANGEBOT"].includes(l.status)).reduce((a, l) => a + (l.dealValue ?? 0), 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1>CRM</h1>
          <p className="text-sm text-slate-500">{leads.length} Kontakte · Pipeline (Termin + Angebot): {eur(pipelineValue)}/Monat</p>
        </div>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Suchen…" className="input w-48" /><button className="btn-ghost">Filtern</button></form>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STATUSES.map((s) => {
          const col = leads.filter((l) => l.status === s);
          return (
            <section key={s} className="w-64 shrink-0 space-y-2 rounded-xl bg-slate-100 p-2">
              <h2 className="px-1 text-sm">{STATUS_LABEL[s]} <span className="text-slate-400">({col.length})</span></h2>
              {col.map((l) => (
                <article key={l.id} className="card space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/crm/${l.id}`} className="font-medium leading-tight hover:underline">{l.name}</Link>
                    <span className={`badge ${scoreColor(l.score)}`}>{l.score}</span>
                  </div>
                  <p className="text-xs text-slate-500">{l.category} · {l.district}</p>
                  {l.nextAction && <p className="text-xs">→ {l.nextAction}</p>}
                  <form action={setLeadStatus} className="flex gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <select name="status" defaultValue={l.status} className="input py-1 text-xs" aria-label="Status">
                      {STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
                    </select>
                    <button className="btn-ghost px-2 py-1 text-xs">OK</button>
                  </form>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
