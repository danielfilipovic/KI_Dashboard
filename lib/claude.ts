import Anthropic from "@anthropic-ai/sdk";
import { getSecret } from "./integrations";
import { assertBudget, recordCost, usdToEur } from "./budget";
import { log } from "./log";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
// $ pro 1 Mio. Tokens (input, output) – Stand 11/2026, bitte bei Anthropic prüfen.
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

const SUPPORTS_FALLBACK = ["claude-opus-5-5", "claude-sonnet-5-5"].includes(MODEL);

export type AiResult = { text: string; demo: boolean };

/**
 * Ein einzelner Claude-Aufruf mit Kostenerfassung und Budget-Stopp.
 * Ohne Schlüssel: Demo-Text, damit der Freigabe-Workflow trotzdem testbar ist.
 */
export async function ask(opts: {
  system: string;
  prompt: string;
  purpose: string;
  demoText: string;
  maxTokens?: number;
}): Promise<AiResult> {
  const apiKey = await getSecret("anthropic");
  if (!apiKey) return { text: opts.demoText, demo: true };

  await assertBudget("anthropic", 0.05);
  const client = new Anthropic({ apiKey });
  try {
    // Server-seitiger Fallback: lehnt das Modell ab, springt automatisch ein passendes Ersatzmodell ein.
    const res = await client.beta.messages.create({
      model: MODEL,
      ...(SUPPORTS_FALLBACK ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      output_config: { effort: "low" }, // kurze, klar umrissene Texte – niedriger Aufwand reicht
      messages: [{ role: "user", content: opts.prompt }],
    });
    const [pin, pout] = PRICES[MODEL] ?? PRICES["claude-opus-5-5"];
    const usd = (res.usage.input_tokens * pin + res.usage.output_tokens * pout) / 1_000_000;
    await recordCost("anthropic", usdToEur(usd), res.usage.input_tokens + res.usage.output_tokens, "Tokens", opts.purpose);

    if (res.stop_reason === "refusal") throw new Error("Claude hat die Anfrage abgelehnt.");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    if (!text) throw new Error("Leere Antwort von Claude");
    return { text, demo: false };
  } catch (e) {
    const msg =
      e instanceof Anthropic.AuthenticationError ? "Ungültiger Anthropic-Schlüssel"
      : e instanceof Anthropic.RateLimitError ? "Rate-Limit erreicht – später erneut versuchen"
      : e instanceof Anthropic.APIError ? `Claude-API-Fehler ${e.status}: ${e.message}`
      : (e as Error).message;
    await log("claude", `${opts.purpose}: ${msg}`, "ERROR");
    throw new Error(msg);
  }
}

export async function testAnthropic(apiKey: string) {
  const client = new Anthropic({ apiKey });
  const m = await client.models.retrieve(MODEL);
  return `Verbunden – Modell ${m.display_name ?? m.id} verfügbar`;
}
