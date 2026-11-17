import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  addTime, chooseHook, generateHooks, generateScript, requestInternalApproval, saveScript, setStage, updateBriefing,
} from "@/app/studio-actions";
import { BriefFields } from "@/components/ClientForm";
import { AssetCard } from "@/components/AssetCard";
import { Uploader } from "@/components/Uploader";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { STAGES, STAGE_LABEL, dt } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Auftrag({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const o = await db.order.findUnique({
    where: { id },
    include: {
      client: true,
      assets: { include: { versions: true }, orderBy: [{ role: "asc" }, { createdAt: "desc" }] },
      events: { orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!o) notFound();
  const hooks = JSON.parse(o.hooks) as string[];
  const idx = STAGES.indexOf(o.stage as (typeof STAGES)[number]);
  const hasFinal = o.assets.some((a) => a.role === "FINAL");
  const pending = o.approvals.find((a) => a.status === "PENDING");
  const prompts = o.script?.split(/##\s*Generierungs-Prompts/i)[1]?.split(/\n##\s/)[0]?.trim();

  return (
    <>
      <Link href="/studio" className="text-sm text-indigo-600">← Studio</Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1>{o.title}</h1>
          <p className="text-sm text-slate-500"><Link className="text-indigo-600" href={`/kunden/${o.clientId}`}>{o.client.name}</Link> · {o.format} · {o.platform} · {o.durationSec} s</p>
        </div>
        <span className="badge bg-indigo-100 text-base text-indigo-800">{STAGE_LABEL[o.stage]}</span>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <ol className="flex flex-wrap gap-1 text-xs">
        {STAGES.map((s, i) => (
          <li key={s} className={`rounded-full px-2 py-1 ${i < idx ? "bg-emerald-100 text-emerald-800" : i === idx ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{i + 1}. {STAGE_LABEL[s]}</li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <details className="card" open={o.stage === "BRIEFING"}>
            <summary className="cursor-pointer"><h2 className="inline">1. Briefing</h2></summary>
            <form action={updateBriefing} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={o.id} />
              <BriefFields o={o} />
              <button className="btn-ghost">Briefing speichern</button>
            </form>
            {o.client.brandNotes && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><b>Markenrichtlinien:</b> {o.client.brandNotes}</p>}
          </details>

          <section id="hooks" className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>2. Hooks</h2>
              <form action={generateHooks}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-ghost" pendingText="Claude schreibt…">{hooks.length ? "Neue Hooks" : "10 Hooks erzeugen"}</SubmitButton></form>
            </div>
            {hooks.length > 0 ? (
              <form action={chooseHook} className="space-y-1">
                <input type="hidden" name="id" value={o.id} />
                {hooks.map((h) => (
                  <label key={h} className="flex items-start gap-2 rounded-lg p-1 text-sm hover:bg-slate-50">
                    <input type="radio" name="hook" value={h} defaultChecked={o.hook === h} className="mt-1" /> {h}
                  </label>
                ))}
                <label className="flex items-start gap-2 p-1 text-sm"><input type="radio" name="hook" value="" className="mt-1" disabled /> <span className="text-slate-400">Eigener Hook: im Skript direkt ändern</span></label>
                <button className="btn-primary">Hook übernehmen</button>
              </form>
            ) : <p className="text-sm text-slate-500">Briefing ausfüllen, dann Hooks erzeugen lassen.</p>}
            {o.hook && <p className="text-sm">Gewählt: <b>{o.hook}</b></p>}
          </section>

          <section id="skript" className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2>3. Skript, Shotlist &amp; Prompts</h2>
              <form action={generateScript}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-ghost" pendingText="Claude schreibt…" >{o.script ? "Neu erzeugen" : "Skript erzeugen"}</SubmitButton></form>
            </div>
            {o.script ? (
              <form action={saveScript} className="space-y-2">
                <input type="hidden" name="id" value={o.id} />
                <textarea name="script" defaultValue={o.script} rows={16} className="input font-mono text-xs" />
                <button className="btn-ghost">Skript speichern</button>
              </form>
            ) : <p className="text-sm text-slate-500">{o.hook ? "Jetzt Skript erzeugen." : "Zuerst einen Hook wählen."}</p>}
            {prompts && (
              <details className="rounded-lg bg-slate-50 p-2 text-sm">
                <summary className="cursor-pointer font-medium">Prompts zum Kopieren (Higgsfield, Kling, Veo …)</summary>
                <pre className="mt-2 whitespace-pre-wrap text-xs">{prompts}</pre>
              </details>
            )}
          </section>

          <section className="card space-y-3">
            <h2>4. Material, Generierung &amp; Schnitt</h2>
            <p className="text-sm text-slate-600">
              Echtes Material und KI-Clips hochladen (Higgsfield-Funktionen ohne API: dort erzeugen, hier hochladen und Werkzeug + Kosten angeben). Den fertigen Schnitt mit Rolle <b>„Final“</b> hochladen.
            </p>
            <Uploader orderId={o.id} defaultRole={o.stage === "SCHNITT" ? "FINAL" : "ROH"} />
            <div className="grid gap-3 sm:grid-cols-2">
              {o.assets.map((a) => <AssetCard key={a.id} a={a} from={`/studio/${o.id}`} />)}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-2">
            <h2>Nächster Schritt</h2>
            {["BRIEFING", "SKRIPT", "GENERIERUNG", "SCHNITT"].includes(o.stage) && (
              <>
                <form action={requestInternalApproval}>
                  <input type="hidden" name="id" value={o.id} />
                  <button className="btn-primary w-full" disabled={!hasFinal}>Zur internen Freigabe</button>
                </form>
                {!hasFinal && <p className="text-xs text-slate-500">Erst möglich, wenn eine Datei mit Rolle „Final“ hochgeladen ist.</p>}
                <form action={setStage} className="flex gap-1">
                  <input type="hidden" name="id" value={o.id} />
                  <select name="stage" defaultValue={o.stage} className="input" aria-label="Phase">
                    {["BRIEFING", "SKRIPT", "GENERIERUNG", "SCHNITT"].map((x) => <option key={x} value={x}>{STAGE_LABEL[x]}</option>)}
                  </select>
                  <button className="btn-ghost">Setzen</button>
                </form>
              </>
            )}
            {o.stage === "INTERN" && <p className="text-sm">Wartet auf deine <Link className="text-indigo-600" href="/freigaben">Freigabe</Link>{pending ? ` („${pending.title}“)` : ""}.</p>}
            {o.stage === "KUNDE" && (
              <>
                <p className="text-sm">Datei(en) an den Kunden schicken. Sobald der Kunde zugestimmt hat (Mail, Telefon, persönlich), hier bestätigen. Kundenportal folgt in Phase 3.</p>
                <form action={setStage}>
                  <input type="hidden" name="id" value={o.id} /><input type="hidden" name="stage" value="AUSGELIEFERT" />
                  <button className="btn-ok w-full">Kunde hat freigegeben → ausgeliefert</button>
                </form>
              </>
            )}
            {o.stage === "AUSGELIEFERT" && <p className="text-sm text-emerald-700">Ausgeliefert am {o.deliveredAt?.toLocaleDateString("de-AT")}.</p>}
          </section>

          <section className="card space-y-2">
            <h2>Zeit</h2>
            <p className="text-2xl font-semibold">{Math.floor(o.minutesSpent / 60)} h {o.minutesSpent % 60} min</p>
            <div className="flex flex-wrap gap-1">
              {[15, 30, 60].map((mnt) => (
                <form key={mnt} action={addTime}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="minutes" value={mnt} /><button className="btn-ghost px-2 py-1 text-xs">+{mnt} min</button></form>
              ))}
              <form action={addTime}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="minutes" value={-15} /><button className="btn-ghost px-2 py-1 text-xs">−15</button></form>
            </div>
            <p className="text-xs text-slate-500">Fließt in „Produktionszeit pro Video“ (Finanzen).</p>
          </section>

          <section className="card space-y-2">
            <h2>Verlauf</h2>
            <ul className="space-y-2 text-sm">
              {o.events.map((e) => <li key={e.id}><span className="text-xs text-slate-400">{dt(e.createdAt)}</span><br />{e.text}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
