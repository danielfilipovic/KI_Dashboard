import Link from "next/link";
import { db } from "@/lib/db";
import { AssetCard } from "@/components/AssetCard";
import { Flash } from "@/components/Flash";
import { mb } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Assets({ searchParams }: { searchParams: Promise<{ kind?: string; client?: string; role?: string; q?: string; vorlagen?: string; ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const [assets, clients, total] = await Promise.all([
    db.asset.findMany({
      where: {
        ...(sp.kind ? { kind: sp.kind } : {}),
        ...(sp.client ? { clientId: sp.client } : {}),
        ...(sp.role ? { role: sp.role } : {}),
        ...(sp.vorlagen ? { isTemplate: true } : {}),
        ...(sp.q ? { OR: [{ name: { contains: sp.q } }, { tags: { contains: sp.q } }, { industry: { contains: sp.q } }] } : {}),
      },
      include: { versions: true, client: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.assetVersion.aggregate({ _sum: { size: true }, _count: true }),
  ]);
  const query = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && !["ok", "error"].includes(k)) as [string, string][]).toString();
  return (
    <>
      <div><h1>Asset-Bibliothek</h1><p className="text-sm text-slate-500">{total._count} Dateiversionen · {mb(total._sum.size ?? 0)} belegt</p></div>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="card grid gap-2 sm:grid-cols-3 lg:grid-cols-6 lg:items-end">
        <input name="q" defaultValue={sp.q} placeholder="Name, Tag, Branche" className="input lg:col-span-2" />
        <select name="kind" defaultValue={sp.kind ?? ""} className="input" aria-label="Typ"><option value="">Alle Typen</option><option value="VIDEO">Video</option><option value="BILD">Bild</option><option value="AUDIO">Audio</option><option value="DOKUMENT">Dokument</option></select>
        <select name="role" defaultValue={sp.role ?? ""} className="input" aria-label="Rolle"><option value="">Alle Rollen</option><option value="ROH">Rohmaterial</option><option value="GENERIERT">KI-Zwischenstand</option><option value="FINAL">Final</option></select>
        <select name="client" defaultValue={sp.client ?? ""} className="input" aria-label="Kunde"><option value="">Alle Kunden</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="vorlagen" value="1" defaultChecked={Boolean(sp.vorlagen)} /> Vorlagen</label>
          <button className="btn-primary">Filtern</button>
        </div>
      </form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => <AssetCard key={a.id} a={a} from={`/assets${query ? `?${query}` : ""}`} />)}
      </div>
      {assets.length === 0 && <p className="card text-sm text-slate-500">Keine Assets. Hochladen geht im <Link className="text-indigo-600" href="/studio">Studio</Link> (pro Auftrag) oder beim Kunden (Markenmaterial).</p>}
    </>
  );
}
