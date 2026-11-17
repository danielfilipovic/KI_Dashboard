import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { addNote, aiAssessLead, deleteLead, draftOutreach, setLeadStatus, updateLead } from "@/app/actions";
import { STATUSES, STATUS_LABEL, dt } from "@/lib/constants";
import { scoreColor } from "@/lib/scoring";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const lead = await db.lead.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "desc" } }, approvals: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) notFound();
  const reasons = JSON.parse(lead.scoreReasons) as string[];

  return (
    <>
      <Link href="/crm" className="text-sm text-indigo-600">← CRM</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>{lead.name}</h1>
          <p className="text-sm text-slate-500">{lead.category} · {lead.address}</p>
        </div>
        <span className={`badge text-base ${scoreColor(lead.score)}`}>Score {lead.score}</span>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="label">Bewertung</span>{lead.rating ?? "–"}★ aus {lead.reviewsCount ?? 0}</p>
            <p><span className="label">Fotos</span>{lead.imagesCount ?? "–"}</p>
            <p><span className="label">Website</span>{lead.website ? <a className="text-indigo-600" href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : "keine"}</p>
            <p><span className="label">Instagram</span>{lead.instagram ? <a className="text-indigo-600" href={lead.instagram} target="_blank" rel="noreferrer">Profil ↗</a> : "nicht gefunden"}</p>
            <p><span className="label">Telefon (Geschäft)</span>{lead.phone ?? "–"}</p>
            <p><span className="label">Karte</span>{lead.mapsUrl ? <a className="text-indigo-600" href={lead.mapsUrl} target="_blank" rel="noreferrer">Google Maps ↗</a> : "–"}</p>
            <div className="sm:col-span-2"><span className="label">Score-Gründe</span>{reasons.join(" · ")}</div>
          </section>

          <section className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>KI-Einschätzung</h2>
              <form action={aiAssessLead}><input type="hidden" name="id" value={lead.id} /><SubmitButton className="btn-ghost" pendingText="Claude denkt…">{lead.aiSummary ? "Neu bewerten" : "Mit Claude bewerten"}</SubmitButton></form>
            </div>
            {lead.aiSummary ? <div className="whitespace-pre-line text-sm">{lead.aiSummary}</div> : <p className="text-sm text-slate-500">Noch keine Einschätzung.</p>}
          </section>

          <section className="card space-y-3">
            <h2>Erstansprache vorbereiten</h2>
            <p className="text-sm text-slate-600">
              In Österreich sind Werbe-E-Mails, -SMS und -Anrufe ohne vorherige Einwilligung auch an Unternehmen unzulässig (§ 174 TKG 2021, früher § 107). Darum: persönlicher Besuch oder Brief. Entwürfe landen in den Freigaben.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["BESUCH", "BRIEF"] as const).map((c) => (
                <form key={c} action={draftOutreach}>
                  <input type="hidden" name="id" value={lead.id} /><input type="hidden" name="channel" value={c} />
                  <SubmitButton className="btn-primary" pendingText="Entwurf…">{c === "BESUCH" ? "Besuchsleitfaden" : "Brief"} entwerfen</SubmitButton>
                </form>
              ))}
            </div>
            {lead.approvals.map((a) => (
              <details key={a.id} className="rounded-lg border border-slate-200 p-2 text-sm">
                <summary className="cursor-pointer">{a.title} · <b>{a.status}</b> · {dt(a.createdAt)}</summary>
                <p className="mt-2 whitespace-pre-line">{a.content}</p>
              </details>
            ))}
          </section>
        </div>

        <div className="space-y-4">
          <form action={setLeadStatus} className="card space-y-2">
            <input type="hidden" name="id" value={lead.id} />
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={lead.status} className="input">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button className="btn-ghost w-full">Status setzen</button>
          </form>

          <form action={updateLead} className="card space-y-2">
            <input type="hidden" name="id" value={lead.id} />
            <label className="label" htmlFor="dealValue">Erwarteter Monatswert (€)</label>
            <input id="dealValue" name="dealValue" type="number" step="1" defaultValue={lead.dealValue ?? ""} className="input" />
            <label className="label" htmlFor="nextAction">Nächster Schritt</label>
            <input id="nextAction" name="nextAction" defaultValue={lead.nextAction ?? ""} className="input" placeholder="z. B. Di vorbeischauen" />
            <input name="nextActionAt" type="date" defaultValue={lead.nextActionAt?.toISOString().slice(0, 10) ?? ""} className="input" aria-label="Datum" />
            <button className="btn-primary w-full">Speichern</button>
          </form>

          <section className="card space-y-2">
            <h2>Verlauf</h2>
            <form action={addNote} className="flex gap-2">
              <input type="hidden" name="id" value={lead.id} />
              <input name="text" className="input" placeholder="Notiz…" />
              <button className="btn-ghost">+</button>
            </form>
            <ul className="space-y-2 text-sm">
              {lead.events.map((e) => (
                <li key={e.id}><span className="text-xs text-slate-400">{dt(e.createdAt)} · {e.type}</span><br />{e.text}</li>
              ))}
            </ul>
          </section>

          <form action={deleteLead} className="card space-y-2">
            <input type="hidden" name="id" value={lead.id} />
            <p className="text-xs text-slate-500">
              DSGVO: {lead.deleteAfter ? `Automatische Löschung ab ${lead.deleteAfter.toLocaleDateString("de-AT")}, solange unbearbeitet.` : "Aktiver Kontakt – keine automatische Löschung."}
            </p>
            <button className="btn-danger w-full">Lead endgültig löschen</button>
          </form>
        </div>
      </div>
    </>
  );
}
