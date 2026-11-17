import { db } from "./db";
import { decrypt } from "./crypto";

export const INTEGRATIONS = {
  apify: { label: "Apify (Google-Maps-Scraping)", env: "APIFY_TOKEN" },
  anthropic: { label: "Anthropic Claude (KI-Kern)", env: "ANTHROPIC_API_KEY" },
} as const;
export type IntegrationKey = keyof typeof INTEGRATIONS;

/** Schlüssel aus DB (verschlüsselt) oder Fallback aus .env. null = Demo-Modus. */
export async function getSecret(key: IntegrationKey): Promise<string | null> {
  const row = await db.integration.findUnique({ where: { key } });
  if (row?.secretEnc) {
    try {
      return decrypt(row.secretEnc);
    } catch {
      return null;
    }
  }
  return process.env[INTEGRATIONS[key].env] || null;
}

export async function ensureIntegrations() {
  for (const [key, def] of Object.entries(INTEGRATIONS)) {
    await db.integration.upsert({
      where: { key },
      update: {},
      create: { key, label: def.label, budgetMonthly: key === "apify" ? 20 : 30 },
    });
  }
}
