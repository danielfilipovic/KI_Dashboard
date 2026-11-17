"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { ask } from "@/lib/claude";
import { HOOKS, SCRIPT, SYSTEM_DE, parseHooks, type Brief } from "@/lib/prompts";
import { PACKAGES, STAGES } from "@/lib/constants";
import { remove } from "@/lib/storage";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const opt = (f: FormData, k: string) => str(f, k) || null;
const date = (f: FormData, k: string) => (str(f, k) ? new Date(str(f, k)) : null);
const back = (path: string, msg: string, kind: "error" | "ok" = "error") =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

async function event(orderId: string, text: string) {
  await db.orderEvent.create({ data: { orderId, text } });
}

// ---------------- Kunden ----------------
function clientData(f: FormData) {
  const pkg = PACKAGES[str(f, "package")] ? str(f, "package") : "STARTER";
  const fee = str(f, "monthlyFee");
  const videos = str(f, "videosPerMonth");
  return {
    name: str(f, "name"),
    industry: opt(f, "industry"),
    contactName: opt(f, "contactName"),
    contactEmail: opt(f, "contactEmail"),
    package: pkg,
    monthlyFee: fee ? Number(fee) : PACKAGES[pkg].fee,
    videosPerMonth: videos ? Number(videos) : PACKAGES[pkg].videos,
    brandNotes: opt(f, "brandNotes"),
    consentAvatar: f.get("consentAvatar") === "on",
    consentVoice: f.get("consentVoice") === "on",
  };
}

export async function createClient(f: FormData) {
  await requireUser();
  const data = clientData(f);
  if (!data.name) back("/kunden", "Name fehlt.");
  const leadId = opt(f, "leadId");
  if (leadId) {
    const existing = await db.client.findUnique({ where: { leadId } });
    if (existing) redirect(`/kunden/${existing.id}`);
    await db.lead.update({ where: { id: leadId }, data: { status: "KUNDE", deleteAfter: null, dealValue: data.monthlyFee } });
    await db.leadEvent.create({ data: { leadId, type: "STATUS", text: "Status → KUNDE" } });
  }
  const client = await db.client.create({ data: { ...data, leadId } });
  await log("kunden", `Neuer Kunde: ${client.name} (${PACKAGES[client.package].label})`);
  revalidatePath("/");
  redirect(`/kunden/${client.id}?ok=${encodeURIComponent("Kunde angelegt.")}`);
}

export async function updateClient(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  await db.client.update({ where: { id }, data: { ...clientData(f), status: str(f, "status") || "AKTIV" } });
  revalidatePath(`/kunden/${id}`);
  back(`/kunden/${id}`, "Gespeichert.", "ok");
}

// ---------------- Aufträge ----------------
function briefData(f: FormData) {
  return {
    title: str(f, "title"),
    format: str(f, "format") || "REEL",
    platform: str(f, "platform") || "Instagram",
    durationSec: Number(str(f, "durationSec") || 20),
    goal: opt(f, "goal"),
    offer: opt(f, "offer"),
    audience: opt(f, "audience"),
    tone: opt(f, "tone"),
    cta: opt(f, "cta"),
    mustHave: opt(f, "mustHave"),
    dueAt: date(f, "dueAt"),
    publishAt: date(f, "publishAt"),
  };
}

export async function createOrder(f: FormData) {
  await requireUser();
  const clientId = str(f, "clientId");
  const data = briefData(f);
  if (!clientId || !data.title) back(clientId ? `/kunden/${clientId}` : "/studio", "Kunde und Thema angeben.");
  const order = await db.order.create({ data: { ...data, clientId } });
  await event(order.id, "Auftrag angelegt");
  await log("studio", `Neuer Auftrag: ${order.title}`);
  redirect(`/studio/${order.id}`);
}

export async function updateBriefing(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  await db.order.update({ where: { id }, data: briefData(f) });
  revalidatePath(`/studio/${id}`);
  back(`/studio/${id}`, "Briefing gespeichert.", "ok");
}

async function briefOf(id: string): Promise<Brief & { hook: string | null; stage: string }> {
  const o = await db.order.findUniqueOrThrow({ where: { id }, include: { client: true } });
  return { ...o, client: o.client.name, industry: o.client.industry, brandNotes: o.client.brandNotes };
}

export async function generateHooks(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const b = await briefOf(id);
  try {
    const r = await ask({
      system: SYSTEM_DE,
      prompt: HOOKS(b),
      purpose: `Hooks: ${b.title}`,
      maxTokens: 2000,
      demoText: [
        "1. Kennst du schon unseren neuen Look? (Frage)",
        "2. Vorher: müde. Nachher: wow. (Vorher/Nachher)",
        "3. 3 Fehler, die deine Haare ruinieren (Zahl)",
        "4. POV: Du kommst endlich zu uns (POV)",
        "5. Das macht im 7. Bezirk keiner so (Kontrast)",
      ].join("\n"),
    });
    const hooks = parseHooks(r.text);
    if (!hooks.length) throw new Error("Keine Hooks erkannt – bitte erneut versuchen.");
    await db.order.update({ where: { id }, data: { hooks: JSON.stringify(hooks), stage: b.stage === "BRIEFING" ? "SKRIPT" : undefined } });
    await event(id, `${hooks.length} Hooks erzeugt${r.demo ? " (Demo)" : ""}`);
  } catch (e) {
    back(`/studio/${id}`, (e as Error).message);
  }
  revalidatePath(`/studio/${id}`);
  redirect(`/studio/${id}#hooks`);
}

export async function chooseHook(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const hook = str(f, "hook");
  if (hook) {
    await db.order.update({ where: { id }, data: { hook } });
    await event(id, `Hook gewählt: ${hook}`);
  }
  revalidatePath(`/studio/${id}`);
  redirect(`/studio/${id}#skript`);
}

export async function generateScript(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const b = await briefOf(id);
  if (!b.hook) back(`/studio/${id}`, "Bitte zuerst einen Hook wählen.");
  try {
    const r = await ask({
      system: SYSTEM_DE,
      prompt: SCRIPT(b, b.hook!),
      purpose: `Skript: ${b.title}`,
      maxTokens: 6000,
      demoText: `## Shotlist (DEMO)\n| Sek | Bild | Quelle | Overlay | Voice-over |\n|---|---|---|---|---|\n| 0–3 | Nahaufnahme Ergebnis | ECHT | ${b.hook} | – |\n| 3–12 | Ablauf im Salon | ECHT | 3 Schritte | Kurz erklärt |\n| 12–18 | Stimmungsbild Wien | KI-Video | – | – |\n| 18–20 | Logo + Adresse | ECHT | ${b.cta ?? "Jetzt Termin buchen"} | – |\n\n## Generierungs-Prompts\n- Scene 3: cinematic slow dolly shot of a cozy Viennese street at golden hour, shallow depth of field, 6 seconds\n\n## Caption\n${b.title} – jetzt Termin sichern! #wien #friseur #haare #beauty #7bezirk\n\n## KI-Kennzeichnung\nKI-Szene ist ein Stimmungsbild ohne Personen – Label empfohlen, aber nicht zwingend.`,
    });
    await db.order.update({ where: { id }, data: { script: r.text } });
    await event(id, `Skript erzeugt${r.demo ? " (Demo)" : ""}`);
  } catch (e) {
    back(`/studio/${id}`, (e as Error).message);
  }
  revalidatePath(`/studio/${id}`);
  redirect(`/studio/${id}#skript`);
}

export async function saveScript(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  await db.order.update({ where: { id }, data: { script: str(f, "script") } });
  await event(id, "Skript bearbeitet");
  revalidatePath(`/studio/${id}`);
  back(`/studio/${id}#skript`, "Skript gespeichert.", "ok");
}

export async function addTime(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const minutes = Math.round(Number(str(f, "minutes")));
  if (!minutes) return;
  await db.order.update({ where: { id }, data: { minutesSpent: { increment: minutes } } });
  revalidatePath(`/studio/${id}`);
}

/** Phasenwechsel mit Qualitätsregeln: Kundenfreigabe nur über interne Freigabe, Auslieferung erst nach Kundenfreigabe. */
export async function setStage(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const stage = str(f, "stage");
  const from = str(f, "from") || `/studio/${id}`;
  if (!STAGES.includes(stage as (typeof STAGES)[number])) return;
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { assets: true } });
  if (stage === "KUNDE" && order.stage !== "KUNDE") back(from, "Die Kundenfreigabe erreichst du nur über die interne Freigabe.");
  if (stage === "INTERN") back(from, "Bitte über „Zur internen Freigabe“ einreichen.");
  if (stage === "AUSGELIEFERT" && order.stage !== "KUNDE") back(from, "Ausliefern geht erst nach der Kundenfreigabe.");
  await db.order.update({ where: { id }, data: { stage, deliveredAt: stage === "AUSGELIEFERT" ? new Date() : undefined } });
  await event(id, `Phase → ${stage}`);
  await log("studio", `${order.title}: Phase → ${stage}`);
  revalidatePath("/studio");
  revalidatePath(`/studio/${id}`);
  if (from !== `/studio/${id}`) redirect(from);
}

export async function requestInternalApproval(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const order = await db.order.findUniqueOrThrow({ where: { id }, include: { client: true, assets: { include: { versions: true } } } });
  const finals = order.assets.filter((a) => a.role === "FINAL");
  if (!finals.length) back(`/studio/${id}`, "Lade zuerst die finale Datei hoch (Rolle „Final“).");
  const ai = finals.some((a) => a.aiGenerated) || order.assets.some((a) => a.aiGenerated);
  const caption = order.script?.split(/##\s*Caption/i)[1]?.split(/\n##/)[0]?.trim();
  await db.approval.create({
    data: {
      type: "CLIENT_DELIVERY",
      title: `Video: ${order.title} (${order.client.name})`,
      content: [
        `Hook: ${order.hook ?? "–"}`,
        caption ? `Caption: ${caption}` : null,
        `Finale Dateien: ${finals.map((a) => `${a.name} v${a.versions.length}${a.aiGenerated ? ` [${a.aiDisclosure ?? "KI"}]` : ""}`).join(", ")}`,
        ai ? "Enthält KI-generierte Inhalte – Kennzeichnung beim Posten setzen." : "Kein KI-generiertes Material.",
      ].filter(Boolean).join("\n"),
      aiGenerated: ai,
      orderId: id,
    },
  });
  await db.order.update({ where: { id }, data: { stage: "INTERN" } });
  await event(id, "Zur internen Freigabe eingereicht");
  revalidatePath("/");
  back(`/studio/${id}`, "Eingereicht – siehe Freigaben.", "ok");
}

// ---------------- Assets ----------------
export async function updateAsset(f: FormData) {
  await requireUser();
  const id = str(f, "id");
  const ai = f.get("aiGenerated") === "on";
  await db.asset.update({
    where: { id },
    data: {
      name: str(f, "name") || undefined,
      role: str(f, "role") || undefined,
      tags: str(f, "tags"),
      aiGenerated: ai,
      aiTool: opt(f, "aiTool"),
      aiDisclosure: ai ? str(f, "aiDisclosure") || "KI-generiert" : null,
      isTemplate: f.get("isTemplate") === "on",
    },
  });
  const from = str(f, "from") || "/assets";
  revalidatePath(from);
  back(from, "Asset gespeichert.", "ok");
}

export async function deleteAsset(f: FormData) {
  await requireUser(["OWNER"]);
  const id = str(f, "id");
  const asset = await db.asset.findUniqueOrThrow({ where: { id }, include: { versions: true } });
  for (const v of asset.versions) await remove(v.storageKey);
  await db.asset.delete({ where: { id } });
  await log("assets", `Asset gelöscht: ${asset.name}`);
  const from = str(f, "from") || "/assets";
  revalidatePath(from);
  back(from, "Asset gelöscht.", "ok");
}
