import { PACKAGES } from "@/lib/constants";

type C = {
  name?: string; industry?: string | null; contactName?: string | null; contactEmail?: string | null; package?: string;
  monthlyFee?: number; videosPerMonth?: number; brandNotes?: string | null; consentAvatar?: boolean; consentVoice?: boolean; status?: string;
};

/** Felder für Kunde anlegen/bearbeiten (in ein <form> einbetten). */
export function ClientFields({ c = {}, withStatus = false }: { c?: C; withStatus?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div><label className="label">Name</label><input name="name" defaultValue={c.name} required className="input" /></div>
      <div><label className="label">Branche</label><input name="industry" defaultValue={c.industry ?? ""} className="input" placeholder="z. B. Friseur" /></div>
      <div><label className="label">Ansprechperson</label><input name="contactName" defaultValue={c.contactName ?? ""} className="input" /></div>
      <div><label className="label">E-Mail (Vertrag)</label><input name="contactEmail" type="email" defaultValue={c.contactEmail ?? ""} className="input" /></div>
      <div>
        <label className="label">Paket</label>
        <select name="package" defaultValue={c.package ?? "STARTER"} className="input">
          {Object.entries(PACKAGES).map(([k, p]) => <option key={k} value={k}>{p.label}{p.fee ? ` – ${p.fee} €/Monat, ${p.videos} Videos` : ""}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">€/Monat</label><input name="monthlyFee" type="number" step="1" defaultValue={c.monthlyFee ?? ""} placeholder="lt. Paket" className="input" /></div>
        <div><label className="label">Videos/Monat</label><input name="videosPerMonth" type="number" defaultValue={c.videosPerMonth ?? ""} placeholder="lt. Paket" className="input" /></div>
      </div>
      <div className="sm:col-span-2"><label className="label">Markenrichtlinien (Ton, Farben, No-Gos, Hashtags)</label><textarea name="brandNotes" defaultValue={c.brandNotes ?? ""} rows={3} className="input" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="consentAvatar" defaultChecked={c.consentAvatar} /> Schriftliche Einwilligung Avatar/Gesicht liegt vor</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="consentVoice" defaultChecked={c.consentVoice} /> Schriftliche Einwilligung Stimmklon liegt vor</label>
      {withStatus && (
        <div><label className="label">Status</label>
          <select name="status" defaultValue={c.status} className="input"><option value="AKTIV">Aktiv</option><option value="PAUSIERT">Pausiert</option><option value="BEENDET">Beendet</option></select>
        </div>
      )}
    </div>
  );
}

/** Briefing-Felder für Aufträge. */
export function BriefFields({ o = {} }: { o?: Record<string, unknown> }) {
  const v = (k: string) => (o[k] as string | null | undefined) ?? "";
  const d = (k: string) => (o[k] instanceof Date ? (o[k] as Date).toISOString().slice(0, 10) : "");
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label">Thema / Titel</label><input name="title" defaultValue={v("title")} required className="input" placeholder="z. B. Balayage-Aktion im Frühling" /></div>
      <div><label className="label">Format</label>
        <select name="format" defaultValue={v("format") || "REEL"} className="input"><option value="REEL">Reel / Kurzvideo</option><option value="BILD">Bild-Post</option><option value="KARUSSELL">Karussell</option><option value="STORY">Story</option></select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Plattform</label><input name="platform" defaultValue={v("platform") || "Instagram"} className="input" /></div>
        <div><label className="label">Sekunden</label><input name="durationSec" type="number" defaultValue={(o.durationSec as number) ?? 20} className="input" /></div>
      </div>
      <div><label className="label">Ziel</label><input name="goal" defaultValue={v("goal")} className="input" placeholder="z. B. 10 Buchungen" /></div>
      <div><label className="label">Angebot</label><input name="offer" defaultValue={v("offer")} className="input" /></div>
      <div><label className="label">Zielgruppe</label><input name="audience" defaultValue={v("audience")} className="input" /></div>
      <div><label className="label">Ton</label><input name="tone" defaultValue={v("tone")} className="input" placeholder="locker, wienerisch, hochwertig …" /></div>
      <div><label className="label">Call-to-Action</label><input name="cta" defaultValue={v("cta")} className="input" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Fällig</label><input name="dueAt" type="date" defaultValue={d("dueAt")} className="input" /></div>
        <div><label className="label">Veröffentlichen</label><input name="publishAt" type="date" defaultValue={d("publishAt")} className="input" /></div>
      </div>
      <div className="sm:col-span-2"><label className="label">Pflichtinhalte / vorhandenes echtes Material</label><textarea name="mustHave" defaultValue={v("mustHave")} rows={2} className="input" /></div>
    </div>
  );
}
