"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { log } from "@/lib/log";
import { scoreLead, type PlaceLite } from "@/lib/scoring";
import { searchPlaces, testApify } from "@/lib/apify";
import { ask, testAnthropic } from "@/lib/claude";
import { LEAD_ASSESSMENT, LEAD_OUTREACH, SYSTEM_DE } from "@/lib/prompts";
import { encrypt } from "@/lib/crypto";
import { INTEGRATIONS, type IntegrationKey } from "@/lib/integrations";
import { STATUSES } from "@/lib/constants";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, msg: string, kind: "error" | "ok" = "error") =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(msg)}`);

// ---------------- Auth ----------------
const attempts = new Map<string, { n: number; until: number }>();

export async function login(form: FormData) {
  const email = str(form, "email").toLowerCase();
  const a = attempts.get(email);
  if (a && a.n >= 5 && Date.now() < a.until) redirect("/login?error=gesperrt");
  const user = await db.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(str(form, "password"), user.passwordHash));
  if (!ok || !user) {
    attempts.set(email, { n: (a?.n ?? 0) + 1, until: Date.now() + 15 * 60_000 });
    await log("auth", `Fehlgeschlagener Login für ${email}`, "WARN");
    redirect("/login?error=1");
  }
  attempts.delete(email);
  await createSession(user.id, user.role);
  await log("auth", `Login: ${email}`);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------------- Lead-Finder ----------------
const SearchSchema = z.object({
  query: z.string().min(2).max(80),
  location: z.string().min(2).max(80),
  maxResults: z.coerce.number().int().min(5).max(200),
});

export async function runLeadSearch(form: FormData) {
  await requireUser();
  const parsed = SearchSchema.safeParse({ query: str(form, "query"), location: str(form, "location"), maxResults: str(form, "maxResults") });
  if (!parsed.success) back("/leads", "Bitte Branche, Ort und Anzahl (5–200) angeben.");
  const { query, location, maxResults } = parsed.data!;

  const search = await db.leadSearch.create({ data: { query, location, maxResults } });
  try {
    const { places, demo, costEur } = await searchPlaces(query, location, maxResults);
    const existing = new Set(
      (await db.lead.findMany({ where: { placeId: { in: places.map((p) => p.placeId).filter(Boolean) as string[] } }, select: { placeId: true } }))
        .map((l) => l.placeId)
    );
    await db.searchResult.createMany({
      data: places.map((p) => {
        const { score, reasons } = scoreLead(p);
        return { searchId: search.id, placeId: p.placeId, data: JSON.stringify(p), score, scoreReasons: JSON.stringify(reasons), imported: existing.has(p.placeId ?? "") };
      }),
    });
    await db.leadSearch.update({ where: { id: search.id }, data: { status: "DONE", resultCount: places.length, costEur, demo } });
    await log("lead-finder", `${demo ? "[DEMO] " : ""}Suche "${query}" in ${location}: ${places.length} Treffer, ${costEur.toFixed(2)} €`);
  } catch (e) {
    const msg = (e as Error).message;
    await db.leadSearch.update({ where: { id: search.id }, data: { status: "FAILED", error: msg } });
    await log("lead-finder", `Suche fehlgeschlagen: ${msg}`, "ERROR");
    back(`/leads?search=${search.id}`, msg);
  }
  redirect(`/leads?search=${search.id}`);
}

export async function importResults(form: FormData) {
  await requireUser();
  const ids = form.getAll("resultId").map(String);
  const searchId = str(form, "searchId");
  if (!ids.length) back(`/leads?search=${searchId}`, "Keine Ergebnisse ausgewählt.");
  const days = Number(process.env.LEAD_RETENTION_DAYS ?? 180);
  const results = await db.searchResult.findMany({ where: { id: { in: ids }, imported: false } });
  let n = 0;
  for (const r of results) {
    const p = JSON.parse(r.data) as PlaceLite;
    const data = {
      name: p.name, category: p.category, address: p.address, district: p.district, city: p.city, phone: p.phone,
      website: p.website, instagram: p.instagram, rating: p.rating, reviewsCount: p.reviewsCount, imagesCount: p.imagesCount,
      claimed: p.claimed, lat: p.lat, lng: p.lng, mapsUrl: p.mapsUrl, score: r.score, scoreReasons: r.scoreReasons, searchId,
      deleteAfter: new Date(Date.now() + days * 86_400_000),
    };
    if (p.placeId) await db.lead.upsert({ where: { placeId: p.placeId }, update: {}, create: { ...data, placeId: p.placeId } });
    else await db.lead.create({ data });
    await db.searchResult.update({ where: { id: r.id }, data: { imported: true } });
    n++;
  }
  await log("crm", `${n} Leads ins CRM übernommen`);
  revalidatePath("/crm");
  back(`/leads?search=${searchId}`, `${n} Leads ins CRM übernommen.`, "ok");
}

// ---------------- CRM ----------------

export async function setLeadStatus(form: FormData) {
  await requireUser();
  const id = str(form, "id");
  const status = str(form, "status");
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) return;
  const lead = await db.lead.update({
    where: { id },
    // Kunden und aktive Gespräche fallen nicht unter die automatische Löschung
    data: { status, deleteAfter: ["NEU", "VERLOREN"].includes(status) ? undefined : null },
  });
  await db.leadEvent.create({ data: { leadId: id, type: "STATUS", text: `Status → ${status}` } });
  await log("crm", `${lead.name}: Status → ${status}`);
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  revalidatePath("/");
}

export async function updateLead(form: FormData) {
  await requireUser();
  const id = str(form, "id");
  const dv = str(form, "dealValue");
  const na = str(form, "nextActionAt");
  await db.lead.update({
    where: { id },
    data: { dealValue: dv ? Number(dv) : null, nextAction: str(form, "nextAction") || null, nextActionAt: na ? new Date(na) : null },
  });
  revalidatePath(`/crm/${id}`);
  back(`/crm/${id}`, "Gespeichert.", "ok");
}

export async function addNote(form: FormData) {
  await requireUser();
  const id = str(form, "id");
  const text = str(form, "text");
  if (text) await db.leadEvent.create({ data: { leadId: id, type: "NOTE", text } });
  revalidatePath(`/crm/${id}`);
}

export async function deleteLead(form: FormData) {
  await requireUser(["OWNER"]);
  const id = str(form, "id");
  const lead = await db.lead.delete({ where: { id } });
  await log("dsgvo", `Lead gelöscht: ${lead.name}`);
  revalidatePath("/crm");
  redirect("/crm");
}

function leadCtx(l: { name: string; category: string | null; district: string | null; rating: number | null; reviewsCount: number | null; imagesCount: number | null; website: string | null; instagram: string | null; scoreReasons: string }) {
  return { ...l, scoreReasons: JSON.parse(l.scoreReasons) as string[] };
}

export async function aiAssessLead(form: FormData) {
  await requireUser();
  const id = str(form, "id");
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  try {
    const r = await ask({
      system: SYSTEM_DE,
      prompt: LEAD_ASSESSMENT(leadCtx(lead)),
      purpose: `Lead-Bewertung ${lead.name}`,
      maxTokens: 1500,
      demoText: `**Potenzial:** mittel – (Demo-Text: Anthropic-Schlüssel unter Einstellungen hinterlegen)\n**Größte digitale Lücke:** ${JSON.parse(lead.scoreReasons)[0] ?? "–"}\n**Passendes Einstiegsangebot:** Starter-Paket mit 4 Kurzvideos\n**Risiko:** unbekannt`,
    });
    await db.lead.update({ where: { id }, data: { aiSummary: r.text } });
    await db.leadEvent.create({ data: { leadId: id, type: "AI", text: `KI-Bewertung erstellt${r.demo ? " (Demo)" : ""}` } });
  } catch (e) {
    back(`/crm/${id}`, (e as Error).message);
  }
  revalidatePath(`/crm/${id}`);
}

export async function draftOutreach(form: FormData) {
  await requireUser();
  const id = str(form, "id");
  const channel = str(form, "channel") === "BRIEF" ? "BRIEF" : "BESUCH";
  const lead = await db.lead.findUniqueOrThrow({ where: { id } });
  try {
    const r = await ask({
      system: SYSTEM_DE,
      prompt: LEAD_OUTREACH(leadCtx(lead), channel),
      purpose: `Erstansprache ${lead.name}`,
      maxTokens: 2000,
      demoText:
        channel === "BESUCH"
          ? `[DEMO] Grüß Gott, ich bin [Name] aus dem Bezirk. Mir ist aufgefallen, dass ${lead.name} super Bewertungen hat, aber online kaum Fotos oder Videos zeigt. Ich mache kurze Videos für lokale Betriebe – darf ich Ihnen gratis ein Probevideo zu Ihrem Angebot machen? Hätten Sie nächste Woche 15 Minuten? Ich lasse Ihnen meine Karte mit QR-Code zu Beispielen da.`
          : `[DEMO] Liebes Team von ${lead.name}, ...`,
    });
    await db.approval.create({
      data: { type: "OUTREACH", title: `${channel === "BESUCH" ? "Besuchsleitfaden" : "Brief"}: ${lead.name}`, content: r.text, channel, leadId: id },
    });
    await db.leadEvent.create({ data: { leadId: id, type: "AI", text: `Entwurf (${channel}) wartet auf Freigabe` } });
    await log("crm", `Entwurf ${channel} für ${lead.name} → Freigabe`);
  } catch (e) {
    back(`/crm/${id}`, (e as Error).message);
  }
  revalidatePath("/");
  back(`/crm/${id}`, "Entwurf erstellt – siehe Freigaben.", "ok");
}

// ---------------- Freigaben ----------------
export async function decideApproval(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const decision = str(form, "decision");
  const from = str(form, "from") || "/freigaben";
  const approval = await db.approval.findUniqueOrThrow({ where: { id } });
  if (approval.status !== "PENDING") back(from, "Bereits entschieden.");

  if (decision === "APPROVED") {
    const labelOk = form.get("aiLabelOk") === "on";
    if (approval.aiGenerated && !labelOk) back(from, "Bitte bestätige Überarbeitung und KI-Kennzeichnung vor der Freigabe.");
    await db.approval.update({
      where: { id },
      data: { status: "APPROVED", content: str(form, "content") || approval.content, aiLabelOk: labelOk, decidedById: user.id, decidedAt: new Date(), comment: str(form, "comment") || null },
    });
    if (approval.leadId && approval.type === "OUTREACH") {
      await db.leadEvent.create({ data: { leadId: approval.leadId, type: "CONTACT", text: `Ansprache freigegeben (${approval.channel})` } });
    }
    if (approval.orderId) {
      await db.order.update({ where: { id: approval.orderId }, data: { stage: "KUNDE" } });
      await db.orderEvent.create({ data: { orderId: approval.orderId, text: "Intern freigegeben → wartet auf Kundenfreigabe" } });
    }
  } else {
    await db.approval.update({ where: { id }, data: { status: "REJECTED", decidedById: user.id, decidedAt: new Date(), comment: str(form, "comment") || null } });
    if (approval.orderId) {
      await db.order.update({ where: { id: approval.orderId }, data: { stage: "SCHNITT" } });
      await db.orderEvent.create({ data: { orderId: approval.orderId, text: "Intern abgelehnt → zurück in den Schnitt" } });
    }
  }
  await log("freigabe", `${approval.title}: ${decision === "APPROVED" ? "freigegeben" : "abgelehnt"}`);
  revalidatePath("/");
  revalidatePath("/freigaben");
  back(from, decision === "APPROVED" ? "Freigegeben." : "Abgelehnt.", "ok");
}

// ---------------- Finanzen ----------------
export async function addRevenue(form: FormData) {
  await requireUser(["OWNER"]);
  const amount = Number(str(form, "amount"));
  if (!(amount > 0)) back("/finanzen", "Betrag fehlt.");
  await db.revenue.create({
    data: { amount, date: new Date(str(form, "date") || Date.now()), stream: str(form, "stream") === "PRODUCT" ? "PRODUCT" : "SERVICE", note: str(form, "note") || null, leadId: str(form, "leadId") || null, clientId: str(form, "clientId") || null },
  });
  revalidatePath("/finanzen");
  back("/finanzen", "Umsatz erfasst.", "ok");
}

export async function addCost(form: FormData) {
  await requireUser(["OWNER"]);
  const amount = Number(str(form, "amount"));
  if (!(amount > 0)) back("/finanzen", "Betrag fehlt.");
  await db.costEntry.create({ data: { amount, tool: str(form, "tool").toLowerCase() || "sonstiges", date: new Date(str(form, "date") || Date.now()), fixed: true, note: str(form, "note") || null } });
  revalidatePath("/finanzen");
  back("/finanzen", "Kosten erfasst.", "ok");
}

// ---------------- Einstellungen ----------------
export async function saveIntegration(form: FormData) {
  await requireUser(["OWNER"]);
  const key = str(form, "key") as IntegrationKey;
  if (!(key in INTEGRATIONS)) return;
  const secret = str(form, "secret");
  const budget = Number(str(form, "budgetMonthly") || 0);
  let secretEnc: string | undefined;
  try {
    secretEnc = secret ? encrypt(secret) : undefined;
  } catch (e) {
    back("/einstellungen", `${(e as Error).message} – im Terminal "npm run env" ausführen und den Server neu starten.`);
  }
  await db.integration.update({
    where: { key },
    data: { budgetMonthly: budget, ...(secretEnc ? { secretEnc, status: "UNKNOWN" } : {}) },
  });
  await log("einstellungen", `Integration ${key} aktualisiert${secret ? " (neuer Schlüssel)" : ""}`);
  back("/einstellungen", "Gespeichert.", "ok");
}

export async function removeSecret(form: FormData) {
  await requireUser(["OWNER"]);
  const key = str(form, "key");
  await db.integration.update({ where: { key }, data: { secretEnc: null, status: "UNKNOWN" } });
  back("/einstellungen", "Schlüssel entfernt.", "ok");
}

export async function testIntegration(form: FormData) {
  await requireUser(["OWNER"]);
  const key = str(form, "key") as IntegrationKey;
  const { getSecret } = await import("@/lib/integrations");
  const secret = await getSecret(key);
  let msg: string;
  try {
    if (!secret) throw new Error("Kein Schlüssel hinterlegt (Demo-Modus)");
    msg = key === "apify" ? await testApify(secret) : await testAnthropic(secret);
    await db.integration.update({ where: { key }, data: { status: "OK", lastCheckAt: new Date(), lastError: null } });
  } catch (e) {
    msg = (e as Error).message;
    await db.integration.update({ where: { key }, data: { status: "ERROR", lastCheckAt: new Date(), lastError: msg } });
    await log("einstellungen", `Test ${key}: ${msg}`, "ERROR");
    back("/einstellungen", `${key}: ${msg}`);
  }
  back("/einstellungen", `${key}: ${msg}`, "ok");
}

/** Löschkonzept: abgelaufene, unbearbeitete Leads und alte Suchrohdaten entfernen. */
export async function runCleanup() {
  await requireUser(["OWNER"]);
  const now = new Date();
  const leads = await db.lead.deleteMany({ where: { deleteAfter: { lt: now }, status: { in: ["NEU", "VERLOREN"] } } });
  const raw = await db.searchResult.deleteMany({ where: { search: { createdAt: { lt: new Date(Date.now() - 30 * 86_400_000) } } } });
  await log("dsgvo", `Bereinigung: ${leads.count} Leads, ${raw.count} Rohdatensätze gelöscht`);
  back("/einstellungen", `Bereinigt: ${leads.count} Leads, ${raw.count} Rohdaten.`, "ok");
}
