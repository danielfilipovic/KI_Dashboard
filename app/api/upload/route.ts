import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { kindFromMime, newKey, saveStream } from "@/lib/storage";
import { log } from "@/lib/log";

const MAX = Number(process.env.UPLOAD_MAX_MB ?? 500) * 1_000_000;
const ALLOWED = /^(video|image|audio)\/|^application\/pdf$|^text\/plain$/;

/**
 * Upload als roher Request-Body (Datei-Inhalt), Metadaten als Query-Parameter.
 * Neue Datei → neues Asset; mit assetId → neue Version eines bestehenden Assets.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !["OWNER", "STAFF"].includes(user.role)) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!req.body) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

  const q = new URL(req.url).searchParams;
  const fileName = (q.get("name") || "datei").slice(0, 200);
  const mime = req.headers.get("content-type") || "application/octet-stream";
  if (!ALLOWED.test(mime)) return NextResponse.json({ error: `Dateityp ${mime} nicht erlaubt` }, { status: 415 });

  const key = newKey(fileName);
  let size: number;
  try {
    size = await saveStream(key, req.body, MAX);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 413 });
  }

  const assetId = q.get("assetId");
  const aiGenerated = q.get("ai") === "1";
  let asset;
  if (assetId) {
    asset = await db.asset.findUniqueOrThrow({ where: { id: assetId }, include: { versions: true } });
    if (q.get("role")) await db.asset.update({ where: { id: assetId }, data: { role: q.get("role")! } });
  } else {
    const order = q.get("orderId") ? await db.order.findUnique({ where: { id: q.get("orderId")! }, include: { client: true } }) : null;
    asset = await db.asset.create({
      data: {
        name: fileName.replace(/\.[^.]+$/, ""),
        kind: kindFromMime(mime),
        role: q.get("role") || "ROH",
        aiGenerated,
        aiTool: q.get("tool") || null,
        aiDisclosure: aiGenerated ? "KI-generiert" : null,
        costEur: Number(q.get("cost") || 0),
        tags: q.get("tags") || "",
        orderId: order?.id ?? null,
        clientId: order?.clientId ?? q.get("clientId") ?? null,
        industry: order?.client.industry ?? null,
      },
      include: { versions: true },
    });
    const cost = Number(q.get("cost") || 0);
    if (cost > 0 && q.get("tool")) {
      await db.costEntry.create({ data: { tool: q.get("tool")!.toLowerCase(), amount: cost, units: 1, unitLabel: "Asset", note: `${asset.name}` } });
    }
  }
  const version = (asset.versions.reduce((m, v) => Math.max(m, v.version), 0) || 0) + 1;
  await db.assetVersion.create({ data: { assetId: asset.id, version, storageKey: key, fileName, mime, size, note: q.get("note") || null } });
  if (asset.orderId) {
    await db.orderEvent.create({ data: { orderId: asset.orderId, text: `Upload: ${fileName} (v${version}, ${(size / 1e6).toFixed(1)} MB)` } });
    // Phase automatisch vorrücken: Material → Generierung, finaler Schnitt → Schnitt (nie zurück)
    const order = await db.order.findUnique({ where: { id: asset.orderId } });
    const role = q.get("role") || asset.role;
    const target = role === "FINAL" ? "SCHNITT" : "GENERIERUNG";
    const early = role === "FINAL" ? ["BRIEFING", "SKRIPT", "GENERIERUNG"] : ["BRIEFING", "SKRIPT"];
    if (order && early.includes(order.stage)) {
      await db.order.update({ where: { id: order.id }, data: { stage: target } });
      await db.orderEvent.create({ data: { orderId: order.id, text: `Phase → ${target} (automatisch nach Upload)` } });
    }
  }
  await log("assets", `Upload ${fileName} (v${version})`);
  return NextResponse.json({ assetId: asset.id, version });
}
