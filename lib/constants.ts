export const STATUSES = ["NEU", "KONTAKTIERT", "TERMIN", "ANGEBOT", "KUNDE", "UPSELL", "VERLOREN"] as const;
export const STATUS_LABEL: Record<string, string> = {
  NEU: "Lead", KONTAKTIERT: "Kontaktiert", TERMIN: "Termin", ANGEBOT: "Angebot", KUNDE: "Kunde", UPSELL: "Upsell", VERLOREN: "Verloren",
};
export const eur = (n: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);
export const dt = (d: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(d);

export const STAGES = ["BRIEFING", "SKRIPT", "GENERIERUNG", "SCHNITT", "INTERN", "KUNDE", "AUSGELIEFERT"] as const;
export const STAGE_LABEL: Record<string, string> = {
  BRIEFING: "Briefing", SKRIPT: "Skript", GENERIERUNG: "Generierung", SCHNITT: "Schnitt",
  INTERN: "Interne Freigabe", KUNDE: "Kundenfreigabe", AUSGELIEFERT: "Ausgeliefert",
};
export const PACKAGES: Record<string, { label: string; fee: number; videos: number }> = {
  STARTER: { label: "Starter", fee: 390, videos: 4 },
  STANDARD: { label: "Standard", fee: 790, videos: 8 },
  PREMIUM: { label: "Premium", fee: 1490, videos: 12 },
  INDIVIDUELL: { label: "Individuell", fee: 0, videos: 0 },
};
export const AI_TOOLS = ["Higgsfield", "Kling", "Veo", "Runway", "HeyGen", "ElevenLabs", "Nano Banana", "Flux", "Midjourney", "Canva", "CapCut", "Sonstiges"];
export const mb = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`;
