import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { removeSecret, runCleanup, saveIntegration, testIntegration } from "@/app/actions";
import { ensureIntegrations, INTEGRATIONS, type IntegrationKey } from "@/lib/integrations";
import { spentThisMonth } from "@/lib/budget";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { dt, eur } from "@/lib/constants";

export const dynamic = "force-dynamic";

const AUTOMATIONS = [
  { name: "Lead-Suche (Google Maps)", trigger: "manuell im Lead-Finder", phase: "1" },
  { name: "Lead-Score", trigger: "automatisch nach jeder Suche", phase: "1" },
  { name: "Budget-Stopp & 80 %-Warnung", trigger: "vor jedem kostenpflichtigen API-Aufruf", phase: "1" },
  { name: "Datenbereinigung (Löschkonzept)", trigger: "manuell hier / Cron in Phase 2", phase: "1" },
  { name: "Trend-Radar-Scan", trigger: "täglich 06:00 (Phase 2)", phase: "2" },
  { name: "Verkaufsdaten-Import", trigger: "Webhook Lemon Squeezy (Phase 2)", phase: "2" },
];

export default async function Einstellungen({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser(["OWNER"]);
  const sp = await searchParams;
  await ensureIntegrations();
  const [integrations, logs, users] = await Promise.all([
    db.integration.findMany({ orderBy: { key: "asc" } }),
    db.logEntry.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    db.user.findMany({ select: { id: true, name: true, email: true, role: true } }),
  ]);
  const spent = Object.fromEntries(await Promise.all(integrations.map(async (i) => [i.key, await spentThisMonth(i.key)] as const)));

  return (
    <>
      <h1>Einstellungen &amp; Integrationen</h1>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="grid gap-4 lg:grid-cols-2">
        {integrations.map((i) => {
          const envSet = Boolean(process.env[INTEGRATIONS[i.key as IntegrationKey]?.env ?? ""]);
          return (
            <div key={i.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2>{i.label}</h2>
                <span className={`badge ${i.status === "OK" ? "bg-emerald-100 text-emerald-700" : i.status === "ERROR" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{i.status}</span>
              </div>
              <p className="text-xs text-slate-500">
                Schlüssel: {i.secretEnc ? "verschlüsselt gespeichert" : envSet ? "aus .env" : "keiner → Demo-Modus"}
                {i.lastCheckAt && ` · zuletzt geprüft ${dt(i.lastCheckAt)}`}{i.lastError && ` · ${i.lastError}`}
              </p>
              <p className="text-sm">Verbrauch Monat: <b>{eur(spent[i.key] ?? 0)}</b> von {i.budgetMonthly ? eur(i.budgetMonthly) : "∞"}</p>
              <form action={saveIntegration} className="space-y-2">
                <input type="hidden" name="key" value={i.key} />
                <input name="secret" type="password" placeholder="Neuen API-Schlüssel einfügen" className="input" autoComplete="off" />
                <div className="flex items-center gap-2">
                  <label className="text-sm" htmlFor={`b-${i.key}`}>Monatslimit €</label>
                  <input id={`b-${i.key}`} name="budgetMonthly" type="number" step="1" defaultValue={i.budgetMonthly} className="input w-24" />
                  <button className="btn-primary">Speichern</button>
                </div>
              </form>
              <div className="flex gap-2">
                <form action={testIntegration}><input type="hidden" name="key" value={i.key} /><SubmitButton className="btn-ghost" pendingText="Teste…">Verbindung testen</SubmitButton></form>
                {i.secretEnc && <form action={removeSecret}><input type="hidden" name="key" value={i.key} /><button className="btn-ghost">Schlüssel entfernen</button></form>}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card space-y-2">
        <h2>Automationen</h2>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {AUTOMATIONS.map((a) => <tr key={a.name}><td className="py-2">{a.name}</td><td className="py-2 text-slate-500">{a.trigger}</td><td className="py-2 text-right"><span className="badge bg-slate-100">Phase {a.phase}</span></td></tr>)}
          </tbody>
        </table>
        <form action={runCleanup}><button className="btn-ghost">Löschkonzept jetzt ausführen</button></form>
      </section>

      <section className="card space-y-2">
        <h2>Benutzer &amp; Rollen</h2>
        <ul className="text-sm">{users.map((u) => <li key={u.id}>{u.name} · {u.email} · <b>{u.role}</b></li>)}</ul>
        <p className="text-xs text-slate-500">Rollen: OWNER (alles), STAFF (ohne Finanzen/Einstellungen), CLIENT (Kundenportal, Phase 3). Weitere Nutzer legst du derzeit per Seed-Skript an.</p>
      </section>

      <section className="card space-y-2">
        <h2>Protokoll</h2>
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-xs">
          {logs.map((l) => <li key={l.id} className="py-1.5"><span className="text-slate-400">{dt(l.createdAt)}</span> <b className={l.level === "ERROR" ? "text-rose-700" : l.level === "WARN" ? "text-amber-700" : ""}>[{l.source}]</b> {l.message}</li>)}
        </ul>
      </section>
    </>
  );
}
