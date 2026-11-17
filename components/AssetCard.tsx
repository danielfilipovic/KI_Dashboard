import { deleteAsset, updateAsset } from "@/app/studio-actions";
import { Uploader } from "@/components/Uploader";
import { AI_TOOLS, mb } from "@/lib/constants";

type V = { id: string; version: number; fileName: string; mime: string; size: number; createdAt: Date };
type A = {
  id: string; name: string; kind: string; role: string; tags: string; aiGenerated: boolean; aiTool: string | null;
  aiDisclosure: string | null; costEur: number; isTemplate: boolean; versions: V[]; client?: { name: string } | null;
};

const ROLE: Record<string, string> = { ROH: "Rohmaterial", GENERIERT: "KI-Zwischenstand", FINAL: "Final" };

export function Preview({ v, className = "" }: { v: V; className?: string }) {
  const src = `/api/files/${v.id}`;
  if (v.mime.startsWith("video/")) return <video src={src} controls preload="metadata" className={`w-full rounded-lg bg-black ${className}`} />;
  if (v.mime.startsWith("image/")) return <img src={src} alt={v.fileName} className={`w-full rounded-lg object-cover ${className}`} />;
  if (v.mime.startsWith("audio/")) return <audio src={src} controls className="w-full" />;
  return <a href={src} target="_blank" rel="noreferrer" className="block rounded-lg bg-slate-100 p-6 text-center text-sm text-indigo-600">{v.fileName} öffnen</a>;
}

/** Asset mit Vorschau, Versionen, KI-Kennzeichnung und Bearbeitung. */
export function AssetCard({ a, from }: { a: A; from: string }) {
  const versions = [...a.versions].sort((x, y) => y.version - x.version);
  const latest = versions[0];
  return (
    <article className="card space-y-2 p-3">
      {latest && <Preview v={latest} className="max-h-72" />}
      <div className="flex flex-wrap items-center gap-1">
        <p className="mr-auto font-medium">{a.name}</p>
        <span className={`badge ${a.role === "FINAL" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{ROLE[a.role] ?? a.role}</span>
        {a.aiGenerated && <span className="badge bg-violet-100 text-violet-700">{a.aiDisclosure ?? "KI"}{a.aiTool ? ` · ${a.aiTool}` : ""}</span>}
        {a.isTemplate && <span className="badge bg-amber-100 text-amber-800">Vorlage</span>}
      </div>
      <p className="text-xs text-slate-500">
        {a.client?.name && `${a.client.name} · `}v{latest?.version} · {latest ? mb(latest.size) : "–"}{a.costEur ? ` · ${a.costEur.toFixed(2)} €` : ""}{a.tags && ` · #${a.tags.split(",").map((t) => t.trim()).filter(Boolean).join(" #")}`}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-indigo-600">Versionen ({versions.length}) &amp; Bearbeiten</summary>
        <ul className="my-2 space-y-1 text-xs">
          {versions.map((v) => (
            <li key={v.id}><a className="text-indigo-600" href={`/api/files/${v.id}?download=1`}>v{v.version} – {v.fileName}</a> <span className="text-slate-400">({mb(v.size)}, {v.createdAt.toLocaleDateString("de-AT")})</span></li>
          ))}
        </ul>
        <Uploader assetId={a.id} compact />
        <form action={updateAsset} className="mt-2 grid gap-2">
          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="from" value={from} />
          <input name="name" defaultValue={a.name} className="input" aria-label="Name" />
          <select name="role" defaultValue={a.role} className="input" aria-label="Rolle">
            {Object.entries(ROLE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input name="tags" defaultValue={a.tags} placeholder="Tags, kommagetrennt" className="input" />
          <label className="flex items-center gap-2"><input type="checkbox" name="aiGenerated" defaultChecked={a.aiGenerated} /> KI-generiert</label>
          <select name="aiTool" defaultValue={a.aiTool ?? ""} className="input" aria-label="KI-Werkzeug">
            <option value="">– Werkzeug –</option>{AI_TOOLS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input name="aiDisclosure" defaultValue={a.aiDisclosure ?? "KI-generiert"} className="input" aria-label="Kennzeichnung" />
          <label className="flex items-center gap-2"><input type="checkbox" name="isTemplate" defaultChecked={a.isTemplate} /> Als Branchen-Vorlage markieren</label>
          <button className="btn-ghost">Speichern</button>
        </form>
        <form action={deleteAsset} className="mt-2">
          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="from" value={from} />
          <button className="text-xs text-rose-700 underline">Asset inkl. aller Versionen löschen</button>
        </form>
      </details>
    </article>
  );
}
