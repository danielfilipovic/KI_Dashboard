import Link from "next/link";
import { db } from "@/lib/db";
import { importResults, runLeadSearch } from "@/app/actions";
import { estimateApifyEur } from "@/lib/apify";
import { scoreColor, type PlaceLite } from "@/lib/scoring";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { dt, eur } from "@/lib/constants";

export const dynamic = "force-dynamic";

const PRESETS = ["Friseur", "Barbershop", "Kosmetikstudio", "Café", "Restaurant", "Fitnessstudio", "Physiotherapie", "Tischlerei", "Elektriker", "Blumengeschäft"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ search?: string; ok?: string; error?: string; min?: string }> }) {
  const sp = await searchParams;
  const min = Number(sp.min ?? 0);
  const searches = await db.leadSearch.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  const current = sp.search ? await db.leadSearch.findUnique({ where: { id: sp.search } }) : null;
  const results = current
    ? await db.searchResult.findMany({ where: { searchId: current.id, score: { gte: min } }, orderBy: { score: "desc" } })
    : [];

  return (
    <>
      <div>
        <h1>Lead-Finder</h1>
        <p className="text-sm text-slate-500">Google-Maps-Suche über Apify. Nur öffentliche Unternehmensdaten – keine Bewertungstexte, keine Personendaten.</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <form action={runLeadSearch} className="card grid gap-3 md:grid-cols-[1fr_1fr_120px_auto] md:items-end">
        <div>
          <label className="label" htmlFor="query">Branche</label>
          <input className="input" id="query" name="query" list="presets" placeholder="z. B. Friseur" required />
          <datalist id="presets">{PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div>
          <label className="label" htmlFor="location">Bezirk / Ort</label>
          <input className="input" id="location" name="location" placeholder="z. B. 1070 Wien, Österreich" required />
        </div>
        <div>
          <label className="label" htmlFor="maxResults">Anzahl</label>
          <input className="input" id="maxResults" name="maxResults" type="number" min={5} max={200} defaultValue={40} />
        </div>
        <SubmitButton pendingText="Suche läuft (bis 5 Min.)…">Suche starten</SubmitButton>
        <p className="text-xs text-slate-500 md:col-span-4">
          Kosten ca. {eur(estimateApifyEur(40))} pro 40 Orte (Apify-Pay-per-Event, Free-Tier-Preis – bitte prüfen). Das Monatsbudget unter Einstellungen stoppt automatisch.
        </p>
      </form>

      {current && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2>
              „{current.query}“ in {current.location}{" "}
              {current.demo && <span className="badge bg-amber-100 text-amber-800">DEMO</span>}
            </h2>
            <div className="flex gap-1 text-sm">
              {[0, 45, 70].map((m) => (
                <Link key={m} href={`/leads?search=${current.id}&min=${m}`} className={`btn-ghost ${min === m ? "ring-2 ring-indigo-300" : ""}`}>
                  {m === 0 ? "Alle" : `Score ≥ ${m}`}
                </Link>
              ))}
            </div>
          </div>
          {current.status === "FAILED" && <p className="text-sm text-rose-700">Fehler: {current.error}</p>}
          <form action={importResults} className="card overflow-x-auto p-0">
            <input type="hidden" name="searchId" value={current.id} />
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3"></th><th className="p-3">Score</th><th className="p-3">Betrieb</th><th className="p-3">Bewertung</th><th className="p-3">Online</th><th className="p-3">Gründe</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => {
                  const p = JSON.parse(r.data) as PlaceLite;
                  const reasons = JSON.parse(r.scoreReasons) as string[];
                  return (
                    <tr key={r.id} className={r.imported ? "opacity-50" : ""}>
                      <td className="p-3">{!r.imported && <input type="checkbox" name="resultId" value={r.id} defaultChecked={r.score >= 60} aria-label={`${p.name} übernehmen`} />}</td>
                      <td className="p-3"><span className={`badge ${scoreColor(r.score)}`}>{r.score}</span></td>
                      <td className="p-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.category} · {p.address}</p>
                        {p.mapsUrl && <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="text-xs text-indigo-600">Karte ↗</a>}
                      </td>
                      <td className="p-3 whitespace-nowrap">{p.rating ?? "–"}★ ({p.reviewsCount ?? 0})</td>
                      <td className="p-3 text-xs">{p.website ? "Web ✓" : "Web ✕"} · {p.instagram ? "IG ✓" : "IG ✕"} · {p.imagesCount ?? 0} Fotos</td>
                      <td className="p-3 text-xs text-slate-600">{reasons.join(" · ")}{r.imported && " · bereits im CRM"}</td>
                    </tr>
                  );
                })}
                {results.length === 0 && <tr><td colSpan={6} className="p-4 text-slate-500">Keine Treffer für diesen Filter.</td></tr>}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-slate-100 p-3">
              <p className="text-xs text-slate-500">{current.resultCount} Treffer · Kosten {eur(current.costEur)} · Rohdaten werden nach 30 Tagen gelöscht</p>
              <button className="btn-primary">Auswahl ins CRM übernehmen</button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-2">
        <h2>Letzte Suchen</h2>
        <ul className="card divide-y divide-slate-100 p-0 text-sm">
          {searches.length === 0 && <li className="p-3 text-slate-500">Noch keine Suche.</li>}
          {searches.map((s) => (
            <li key={s.id}>
              <Link href={`/leads?search=${s.id}`} className="flex justify-between gap-2 p-3 hover:bg-slate-50">
                <span>{s.query} · {s.location} {s.demo && <span className="badge bg-amber-100 text-amber-800">DEMO</span>}</span>
                <span className="text-slate-500">{s.status} · {s.resultCount} · {dt(s.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
