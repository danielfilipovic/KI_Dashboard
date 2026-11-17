import { db } from "@/lib/db";
import { ApprovalCard } from "@/components/ApprovalCard";
import { Flash } from "@/components/Flash";
import { dt } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Freigaben({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const [pending, done] = await Promise.all([
    db.approval.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.approval.findMany({ where: { status: { not: "PENDING" } }, orderBy: { decidedAt: "desc" }, take: 20, include: { decidedBy: true } }),
  ]);
  return (
    <>
      <div>
        <h1>Freigaben</h1>
        <p className="text-sm text-slate-500">Alles, was nach außen geht, braucht deinen Klick. Text vor der Freigabe direkt anpassen.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="space-y-4">
        {pending.length === 0 && <p className="card text-sm text-slate-500">Keine offenen Freigaben.</p>}
        {pending.map((a) => <ApprovalCard key={a.id} a={a} from="/freigaben" />)}
      </div>
      <section className="space-y-2">
        <h2>Entschieden (Protokoll)</h2>
        <ul className="card divide-y divide-slate-100 p-0 text-sm">
          {done.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 p-3">
              <span>{a.title}</span>
              <span className="text-slate-500">
                <b className={a.status === "APPROVED" ? "text-emerald-700" : "text-rose-700"}>{a.status === "APPROVED" ? "freigegeben" : "abgelehnt"}</b>
                {" "}von {a.decidedBy?.name ?? "?"} · {a.decidedAt ? dt(a.decidedAt) : ""}{a.aiGenerated ? ` · KI-Prüfung ${a.aiLabelOk ? "✓" : "–"}` : ""}
              </span>
            </li>
          ))}
          {done.length === 0 && <li className="p-3 text-slate-500">Noch nichts entschieden.</li>}
        </ul>
      </section>
    </>
  );
}
