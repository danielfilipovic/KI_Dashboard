import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.OWNER_EMAIL ?? "").toLowerCase();
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!email || password.length < 12) throw new Error("OWNER_EMAIL und OWNER_PASSWORD (min. 12 Zeichen) in .env setzen");
  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: process.env.OWNER_NAME ?? "Inhaber", role: "OWNER", passwordHash: await bcrypt.hash(password, 12) },
  });
  for (const [key, label, budget] of [["apify", "Apify (Google-Maps-Scraping)", 20], ["anthropic", "Anthropic Claude (KI-Kern)", 30]] as const) {
    await db.integration.upsert({ where: { key }, update: {}, create: { key, label, budgetMonthly: budget } });
  }
  await db.logEntry.create({ data: { source: "setup", message: "Cockpit eingerichtet" } });
  console.log(`✓ Inhaber ${email} angelegt. Start: npm run dev → http://localhost:3000`);
}

main().finally(() => db.$disconnect());
