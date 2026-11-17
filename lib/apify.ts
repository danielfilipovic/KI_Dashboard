import { getSecret } from "./integrations";
import { assertBudget, recordCost, usdToEur } from "./budget";
import type { PlaceLite } from "./scoring";

const ACTOR = "compass~crawler-google-places";
// Preis lt. Apify Store (Stand 11/2026, FREE-Tier): 0,004 $/Ort + 0,002 $/Ort Kontakt-Anreicherung. Bitte prüfen.
const USD_PER_PLACE = 0.004 + 0.002;

type ApifyPlace = {
  placeId?: string; title: string; categoryName?: string | null; address?: string; neighborhood?: string | null;
  city?: string | null; postalCode?: string | null; phone?: string; website?: string; instagrams?: string[];
  totalScore?: number | null; reviewsCount?: number | null; imagesCount?: number; claimThisBusiness?: boolean;
  location?: { lat: number; lng: number }; url?: string; permanentlyClosed?: boolean; temporarilyClosed?: boolean;
};

function normalize(p: ApifyPlace): PlaceLite {
  return {
    placeId: p.placeId ?? null,
    name: p.title,
    category: p.categoryName ?? null,
    address: p.address ?? null,
    district: p.neighborhood ?? p.postalCode ?? null,
    city: p.city ?? null,
    phone: p.phone || null,
    website: p.website || null,
    instagram: p.instagrams?.[0] ?? null,
    rating: p.totalScore ?? null,
    reviewsCount: p.reviewsCount ?? null,
    imagesCount: p.imagesCount ?? null,
    claimed: p.claimThisBusiness === undefined ? null : !p.claimThisBusiness,
    lat: p.location?.lat ?? null,
    lng: p.location?.lng ?? null,
    mapsUrl: p.url ?? null,
    closed: Boolean(p.permanentlyClosed || p.temporarilyClosed),
  };
}

export function estimateApifyEur(maxResults: number) {
  return usdToEur(maxResults * USD_PER_PLACE);
}

/**
 * Startet den Google-Maps-Scraper synchron (max. ~5 Min.) und liefert normalisierte Orte.
 * DSGVO: Nur Unternehmensdaten. Bewertungen, Reviewer-Daten und Personen-Leads sind bewusst deaktiviert.
 */
export async function searchPlaces(query: string, location: string, maxResults: number) {
  const token = await getSecret("apify");
  if (!token) return { demo: true, places: demoPlaces(query, location, maxResults), costEur: 0 };

  const est = estimateApifyEur(maxResults);
  await assertBudget("apify", est);

  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=280&clean=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        searchStringsArray: [query],
        locationQuery: location,
        maxCrawledPlacesPerSearch: maxResults,
        language: "de",
        skipClosedPlaces: false,
        scrapeContacts: true, // Website/Instagram des Betriebs
        maxReviews: 0,
        maxImages: 0,
        scrapeReviewsPersonalData: false,
        maximumLeadsEnrichmentRecords: 0, // keine Personendaten
      }),
      signal: AbortSignal.timeout(300_000),
    }
  );
  if (!res.ok) throw new Error(`Apify-Fehler ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const items = (await res.json()) as ApifyPlace[];
  const costEur = usdToEur(items.length * USD_PER_PLACE);
  await recordCost("apify", costEur, items.length, "Orte", `Suche: ${query} / ${location}`);
  return { demo: false, places: items.map(normalize), costEur };
}

export async function testApify(token: string) {
  const res = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { data?: { username?: string } };
  return `Verbunden als ${j.data?.username ?? "?"}`;
}

// ---------- Demo-Daten (ohne API-Schlüssel) ----------
function demoPlaces(query: string, location: string, n: number): PlaceLite[] {
  const names = ["Salon Haarmonie", "Studio Schnittpunkt", "Barber Brothers", "Coiffeur Elegance", "Hairloft",
    "Frisör am Eck", "Kopfsache", "Glanz & Schnitt", "Mähne Wien", "Cut & Color Lounge", "Locken-Werk", "Haarzeit"];
  const base = { lat: 48.2082, lng: 16.3738 };
  let seed = query.length * 31 + location.length * 17;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  return Array.from({ length: Math.min(n, names.length) }, (_, i) => ({
    placeId: `demo-${query}-${location}-${i}`.replace(/\s+/g, "-").toLowerCase(),
    name: `${names[i]} (Demo)`,
    category: query,
    address: `Demogasse ${i + 1}, ${location}`,
    district: location,
    city: location.split(",")[0],
    phone: null,
    website: rnd() > 0.5 ? `https://example.com/${i}` : null,
    instagram: rnd() > 0.6 ? `https://instagram.com/demo${i}` : null,
    rating: Math.round((3.6 + rnd() * 1.4) * 10) / 10,
    reviewsCount: Math.round(rnd() * 250),
    imagesCount: Math.round(rnd() * 60),
    claimed: rnd() > 0.2,
    lat: base.lat + (rnd() - 0.5) * 0.04,
    lng: base.lng + (rnd() - 0.5) * 0.06,
    mapsUrl: null,
  }));
}
