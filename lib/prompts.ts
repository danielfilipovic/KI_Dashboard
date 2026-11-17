/**
 * Prompt-Bibliothek (Phase 1 aktiv: LEAD_*). Die übrigen Prompts sind für Phase 2
 * vorbereitet und stehen auch im Konzept (docs/KONZEPT.md, Kapitel 8).
 */
export const BUSINESS = {
  name: process.env.BUSINESS_NAME || "[Deine Marke]",
  region: process.env.BUSINESS_REGION || "Wien",
};

export const SYSTEM_DE = `Du arbeitest für ${BUSINESS.name}, einen Ein-Personen-Anbieter für KI-gestützte Kurzvideos und Social-Media-Content für lokale Betriebe in ${BUSINESS.region}.
Schreibe auf Deutsch (österreichische Varianten erlaubt, z. B. "Jänner"), konkret, ohne Marketing-Floskeln, ohne Übertreibungen und ohne erfundene Fakten.
Wenn dir Informationen fehlen, sag das, statt zu raten.`;

type LeadCtx = {
  name: string; category?: string | null; district?: string | null; rating?: number | null;
  reviewsCount?: number | null; imagesCount?: number | null; website?: string | null;
  instagram?: string | null; scoreReasons: string[];
};

const leadBlock = (l: LeadCtx) => `Betrieb: ${l.name}
Branche: ${l.category ?? "unbekannt"}
Bezirk/Ort: ${l.district ?? "unbekannt"}
Google-Bewertung: ${l.rating ?? "–"} ★ aus ${l.reviewsCount ?? 0} Bewertungen
Fotos im Maps-Profil: ${l.imagesCount ?? "unbekannt"}
Website: ${l.website ?? "keine"}
Instagram: ${l.instagram ?? "nicht gefunden"}
Regel-Score-Begründung: ${l.scoreReasons.join("; ") || "–"}`;

export const LEAD_ASSESSMENT = (l: LeadCtx) => `Bewerte diesen lokalen Betrieb als potenziellen Kunden für monatliche Kurzvideo-Pakete.

${leadBlock(l)}

Antworte in genau diesem Format, max. 120 Wörter:
**Potenzial:** hoch / mittel / niedrig – ein Satz Begründung
**Größte digitale Lücke:** ein Satz
**Passendes Einstiegsangebot:** Paket + ein konkretes Video-Beispiel für genau diese Branche
**Risiko:** ein Satz (z. B. kein Budget, Kette mit Zentrale, schon Agentur)`;

export const LEAD_OUTREACH = (l: LeadCtx, channel: "BESUCH" | "BRIEF") =>
  channel === "BESUCH"
    ? `Schreibe einen Gesprächsleitfaden für einen persönlichen Kurzbesuch (unter 60 Sekunden) bei diesem Betrieb.

${leadBlock(l)}

Struktur:
1. Einstieg (1 Satz, persönlicher Bezug zum Betrieb, z. B. etwas aus den Bewertungen – nur wenn oben belegt)
2. Beobachtung (1 Satz, die größte digitale Lücke, wertschätzend formuliert)
3. Angebot (1–2 Sätze: kostenloses Probevideo zu einem konkreten Thema dieses Betriebs)
4. Frage nach einem 15-Minuten-Termin
5. Was ich als Leave-Behind dalasse (1 Satz)
Kein Druck, keine Rabattversprechen.`
    : `Schreibe einen kurzen Brief (Post, max. 150 Wörter) an diesen Betrieb.

${leadBlock(l)}

Anforderungen: persönliche Anrede an "das Team von ${l.name}", eine konkrete Beobachtung, Angebot eines kostenlosen Probevideos, Kontakt per QR-Code-Hinweis "[QR-Code]", Absender "[Name, Adresse, Telefon]". Kein Hinweis darauf, dass der Text KI-generiert ist, aber auch keine erfundenen Details.`;

// ---- Phase 2: Marketing-Studio ----
export type Brief = {
  client: string; industry?: string | null; brandNotes?: string | null; title: string; format: string; platform: string;
  durationSec: number; goal?: string | null; offer?: string | null; audience?: string | null; tone?: string | null;
  cta?: string | null; mustHave?: string | null;
};

const briefBlock = (b: Brief) => `Kunde: ${b.client} (${b.industry ?? "Branche unbekannt"})
Markenrichtlinien: ${b.brandNotes || "keine hinterlegt"}
Thema: ${b.title}
Format: ${b.format}, ${b.durationSec} Sekunden, Plattform: ${b.platform}
Ziel: ${b.goal || "–"}
Angebot: ${b.offer || "–"}
Zielgruppe: ${b.audience || "–"}
Ton: ${b.tone || "–"}
Call-to-Action: ${b.cta || "–"}
Pflichtinhalte / vorhandenes echtes Material: ${b.mustHave || "–"}`;

export const HOOKS = (b: Brief) => `Erzeuge 10 Hooks (max. 8 Wörter) für dieses Video.

${briefBlock(b)}

Mische Typen: Frage, Kontrast, Zahl, Vorher/Nachher, POV, Insider-Tipp.
Regeln: kein Clickbait, das das Video nicht einlöst; keine Superlative ohne Beleg; Wiener Bezug nur, wo er natürlich passt.
Antworte NUR mit 10 Zeilen in genau diesem Format, ohne Einleitung:
1. Hook-Text (Typ)`;

export const SCRIPT = (b: Brief, hook: string) => `Schreibe ein Skript für dieses Hochformat-Video (9:16). Hook: "${hook}"

${briefBlock(b)}

Gliederung (Markdown):
## Shotlist
Tabelle: Sekunde | Bild | Quelle (ECHT / KI-Video / KI-Bild) | Text-Overlay | Voice-over
Bevorzuge echtes Material des Kunden; KI nur dort, wo es echtes Material sinnvoll ergänzt.
## Generierungs-Prompts
Für jede KI-Szene ein englischer Prompt (Motiv, Kamera, Licht, Stimmung, Dauer). Keine realen Personen, keine Marken oder Logos Dritter.
## Caption
Max. 150 Zeichen + 5 Hashtags.
## KI-Kennzeichnung
Ein Satz: ob ein Label nötig ist (realistische KI-Szenen, Stimmen, Personen) und welches Plattform-Label zu setzen ist.`;

export function parseHooks(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*\d+[.)]\s*(.+)$/)?.[1]?.trim())
    .filter((h): h is string => Boolean(h))
    .slice(0, 12);
}
