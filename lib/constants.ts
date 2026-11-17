export const STATUSES = ["NEU", "KONTAKTIERT", "TERMIN", "ANGEBOT", "KUNDE", "UPSELL", "VERLOREN"] as const;
export const STATUS_LABEL: Record<string, string> = {
  NEU: "Lead", KONTAKTIERT: "Kontaktiert", TERMIN: "Termin", ANGEBOT: "Angebot", KUNDE: "Kunde", UPSELL: "Upsell", VERLOREN: "Verloren",
};
export const eur = (n: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);
export const dt = (d: Date) => new Intl.DateTimeFormat("de-AT", { dateStyle: "short", timeStyle: "short" }).format(d);
