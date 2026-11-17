import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { createOrder, updateClient } from "@/app/studio-actions";
import { BriefFields, ClientFields } from "@/components/ClientForm";
import { AssetCard } from "@/components/AssetCard";
import { Uploader } from "@/components/Uploader";
import { Flash } from "@/components/Flash";
import { PACKAGES, STAGE_LABEL, eur } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function KundeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; m?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const c = await db.client.findUnique({
    where: { id },
    include: {
      orders: { orderBy: [{ publishAt: "asc" }, { createdAt: "desc" }] },
      assets: { where: { orderId: null }, include: { versions: true }, orderBy: { createdAt: "desc" } },
      revenues: { orderBy: { date: "desc" }, take: 6 },
    },
  });
  if (!c) notFound();

  // Content-Kalender: Monatsansicht nach Veröffentlichungstermin
  const now = new Date();
  const [y, m] = (sp.m ?? `${now.getFullYear()}-${now.getMonth() + 1}`).split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7; // Montag = 0
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1);
  const inMonth = c.orders.filter((o) => o.publishAt && o.publishAt.getFullYear() === y && o.publishAt.getMonth() === m - 1);
  const ltv = c.revenues.reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <Link href="/kunden" className="text-sm text-indigo-600">← Kunden</Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1>{c.name}</h1>
          <p className="text-sm text-slate-500">{c.industry} · {PACKAGES[c.package]?.label} · {eur(c.monthlyFee)}/Monat · {c.videosPerMonth} Videos · Kunde seit {c.startDate.toLocaleDateString("de-AT")}</p>
        </div>
        {c.leadId && <Link href={`/crm/${c.leadId}`} className="btn-ghost">CRM-Verlauf</Link>}
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2>Content-Kalender {first.toLocaleDateString("de-AT", { month: "long", year: "numeric" })}</h2>
          <div className="flex gap-1">
            <Link className="btn-ghost px-2 py-1" href={`/kunden/${id}?m=${prev.getFullYear()}-${prev.getMonth() + 1}`}>←</Link>
            <Link className="btn-ghost px-2 py-1" href={`/kunden/${id}?m=${next.getFullYear()}-${next.getMonth() + 1}`}>→</Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => <div key={d} className="p-1 text-center font-medium text-slate-500">{d}</div>)}
          {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const items = inMonth.filter((o) => o.publishAt!.getDate() === day);
            return (
              <div key={day} className="min-h-16 rounded-md border border-slate-100 p-1">
                <p className="text-slate-400">{day}</p>
                {items.map((o) => (
                  <Link key={o.id} href={`/studio/${o.id}`} title={STAGE_LABEL[o.stage]}
                    className={`mt-0.5 block truncate rounded px-1 ${o.stage === "AUSGELIEFERT" ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>{o.title}</Link>
                ))}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500">{inMonth.length} Inhalte geplant · Termin über „Veröffentlichen“ im Briefing setzen.</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-2">
          <h2>Aufträge</h2>
          <ul className="card divide-y divide-slate-100 p-0 text-sm">
            {c.orders.map((o) => (
              <li key={o.id}>
                <Link href={`/studio/${o.id}`} className="flex justify-between gap-2 p-3 hover:bg-slate-50">
                  <span>{o.title}</span>
                  <span className="text-slate-500">{STAGE_LABEL[o.stage]}{o.publishAt ? ` · ${o.publishAt.toLocaleDateString("de-AT")}` : ""}</span>
                </Link>
              </li>
            ))}
            {c.orders.length === 0 && <li className="p-3 text-slate-500">Noch keine Aufträge.</li>}
          </ul>
          <details className="card">
            <summary className="cursor-pointer font-medium">+ Neuer Auftrag (Briefing)</summary>
            <form action={createOrder} className="mt-3 space-y-3">
              <input type="hidden" name="clientId" value={c.id} />
              <BriefFields o={{ platform: "Instagram", durationSec: 20, tone: c.brandNotes ? "laut Markenrichtlinien" : "" }} />
              <button className="btn-primary">Auftrag anlegen</button>
            </form>
          </details>
        </section>
        <section className="space-y-2">
          <h2>Stammdaten</h2>
          <form action={updateClient} className="card space-y-3">
            <input type="hidden" name="id" value={c.id} />
            <ClientFields c={c} withStatus />
            <button className="btn-primary">Speichern</button>
          </form>
          <p className="text-xs text-slate-500">Umsatz bisher (erfasst): {eur(ltv)}</p>
        </section>
      </div>

      <section className="space-y-2">
        <h2>Markenmaterial (Logos, Fotos, Musterclips)</h2>
        <Uploader clientId={c.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {c.assets.map((a) => <AssetCard key={a.id} a={a} from={`/kunden/${c.id}`} />)}
        </div>
      </section>
    </>
  );
}
