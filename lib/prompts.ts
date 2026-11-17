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

// ---- Phase 2 (vorbereitet) ----
export const HOOKS = (brief: string) => `Erzeuge 10 Hooks (max. 8 Wörter) für ein 15–30-Sekunden-Video. Briefing:\n${brief}\nMische Typen: Frage, Kontrast, Zahl, Vorher/Nachher, "POV". Gib pro Hook den Typ in Klammern an.`;
