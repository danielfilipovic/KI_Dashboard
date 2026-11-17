/**
 * Regelbasierter, erklärbarer Lead-Score (0–100).
 * Idee: Wer gute Bewertungen hat (= zahlungsfähiger, aktiver Betrieb), aber
 * digital schwach auftritt, hat den größten Bedarf an Content.
 */
export type PlaceLite = {
  placeId?: string | null;
  name: string;
  category?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  imagesCount?: number | null;
  claimed?: boolean | null;
  lat?: number | null;
  lng?: number | null;
  mapsUrl?: string | null;
  closed?: boolean;
};

export function scoreLead(p: PlaceLite): { score: number; reasons: string[] } {
  if (p.closed) return { score: 0, reasons: ["Geschlossen – kein Lead"] };
  let s = 0;
  const r: string[] = [];
  const rating = p.rating ?? 0;
  const reviews = p.reviewsCount ?? 0;

  if (rating >= 4.3 && reviews >= 30) { s += 25; r.push(`Starke Bewertungen (${rating}★, ${reviews}) – Betrieb läuft`); }
  else if (rating >= 4.0 && reviews >= 10) { s += 15; r.push(`Solide Bewertungen (${rating}★, ${reviews})`); }
  else if (reviews < 10) { s += 5; r.push("Wenige Bewertungen – Sichtbarkeit fehlt"); }

  if (!p.website) { s += 20; r.push("Keine Website"); }
  if (!p.instagram) { s += 20; r.push("Kein Instagram-Profil gefunden"); }

  const imgs = p.imagesCount ?? 0;
  if (imgs < 10) { s += 15; r.push(`Nur ${imgs} Fotos im Maps-Profil`); }
  else if (imgs < 30) { s += 8; r.push(`Wenige Fotos (${imgs})`); }

  if (p.claimed === false) { s += 10; r.push("Unternehmensprofil nicht beansprucht"); }
  if (reviews > 400) { s -= 10; r.push("Sehr groß – evtl. eigene Agentur"); }

  return { score: Math.max(0, Math.min(100, s)), reasons: r };
}

export function scoreColor(score: number) {
  if (score >= 70) return "bg-emerald-100 text-emerald-800";
  if (score >= 45) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}
