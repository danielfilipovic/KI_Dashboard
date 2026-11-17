# Business Cockpit – Phase 1 (MVP)

Web-App zur Steuerung einer Ein-Personen-Content-Agentur: Lead-Finder (Google Maps über Apify), CRM, KI-Entwürfe mit Pflicht-Freigabe, Dashboard, Finanzen/Kosten mit Budget-Stopp.
Konzept, Preise, Architektur und Roadmap: **[docs/KONZEPT.md](docs/KONZEPT.md)**.

## Schnellstart (lokal, ca. 5 Minuten)

Voraussetzung: Node.js ≥ 20.

```bash
npm install
cp .env.example .env
```

In `.env` zwei Zufallswerte eintragen (`ENCRYPTION_KEY`, `SESSION_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Außerdem `OWNER_EMAIL` und `OWNER_PASSWORD` (mindestens 12 Zeichen) setzen. Dann:

```bash
npm run setup
npm run dev
```

→ http://localhost:3000 öffnen und mit den Inhaber-Daten anmelden.

### Login klappt nicht?

- **Passwort zurücksetzen:** Server mit Strg + C stoppen, dann `npm run passwort` ausführen, E-Mail und neues Passwort eingeben, danach `npm run dev`.
- Passwort in `.env` geändert? `npm run setup` erneut ausführen; das Passwort aus `.env` wird übernommen.
- Passwörter mit `#` oder `$` in `.env` immer in Anführungszeichen setzen: `OWNER_PASSWORD="Mein#Passwort$2026"`.
- Nach 5 Fehlversuchen ist das Konto 15 Minuten gesperrt. Ein Neustart des Servers hebt die Sperre auf.

**Ohne API-Schlüssel läuft alles im Demo-Modus** (Beispiel-Betriebe, Beispieltexte, keine Kosten). Echte Schlüssel trägst du unter **Einstellungen** ein. Sie werden dort AES-256-GCM-verschlüsselt gespeichert. Alternativ setzt du `APIFY_TOKEN` und `ANTHROPIC_API_KEY` in `.env`.

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `DATABASE_URL` | ✅ | `file:./dev.db` (SQLite) oder Postgres-URL |
| `ENCRYPTION_KEY` | ✅ | 32 Byte base64 – verschlüsselt API-Schlüssel. **Nicht verlieren**, sonst sind gespeicherte Schlüssel unlesbar |
| `SESSION_SECRET` | ✅ | ≥ 32 Zeichen, signiert Login-Sessions |
| `OWNER_EMAIL` / `OWNER_PASSWORD` / `OWNER_NAME` | ✅ (Setup) | erster Inhaber-Account |
| `APIFY_TOKEN` | – | Fallback, falls nicht in den Einstellungen gespeichert |
| `ANTHROPIC_API_KEY` | – | dito |
| `CLAUDE_MODEL` | – | Standard `claude-opus-5-5`; günstiger: `claude-sonnet-5-5`, `claude-haiku-5-5` |
| `USD_EUR_RATE` | – | Umrechnung der Dollar-Preise der APIs (Standard 0.92) |
| `LEAD_RETENTION_DAYS` | – | Löschfrist für unbearbeitete Leads (Standard 180) |
| `BUSINESS_NAME` / `BUSINESS_REGION` | – | Kontext für die KI-Texte |

## Projektstruktur

```
app/
  actions.ts              Server Actions (Auth, Lead-Suche, CRM, Freigaben, Finanzen, Einstellungen)
  login/page.tsx          Login
  (app)/layout.tsx        Navigation, Auth-Schutz, Freigabe-Zähler
  (app)/page.tsx          Dashboard (KPIs, Freigaben, Aktivität, Charts)
  (app)/leads/            Lead-Finder
  (app)/crm/              Kanban + Lead-Detail (KI-Bewertung, Erstansprache)
  (app)/freigaben/        Human-in-the-Loop
  (app)/finanzen/         Umsatz, Kosten, Deckungsbeitrag
  (app)/einstellungen/    Integrationen, Budgets, Automationen, Protokoll, Löschkonzept
components/               ApprovalCard, BarChart, Flash, SubmitButton
lib/
  apify.ts                Google-Maps-Scraper (compass/crawler-google-places) + Demo-Daten
  claude.ts               Claude-Aufruf mit Kostenbuchung, Budget-Stopp, Refusal-Fallback
  scoring.ts              erklärbarer Lead-Score
  prompts.ts              Prompt-Bibliothek
  budget.ts               Monatsbudget, automatischer Stopp, Kostenbuchung
  crypto.ts               AES-256-GCM
  auth.ts                 Session (JWT/httpOnly-Cookie), Rollen
prisma/schema.prisma      Datenmodell Phase 1
prisma/seed.ts            Inhaber + Integrationen anlegen
docs/                     Konzept + Screenshots
```

## Produktion (Empfehlung: Hetzner + Coolify)

1. Hetzner Cloud CX22 (Standort Falkenstein oder Nürnberg) anlegen und [Coolify](https://coolify.io) installieren.
2. In Coolify eine PostgreSQL-Instanz anlegen und deren URL als `DATABASE_URL` übernehmen.
3. In `prisma/schema.prisma` die Zeile `provider = "sqlite"` auf `provider = "postgresql"` ändern.
4. App aus Git deployen. Build-Befehl: `npm ci && npx prisma db push && npm run build`, Start-Befehl: `npm start`.
5. Einmalig `npm run db:seed` ausführen.
6. Domain mit HTTPS einrichten (Coolify/Let's Encrypt).
7. Tägliches Backup: Coolify-Backup für Postgres an eine Hetzner Storage Box oder einen S3-Speicher.
8. AV-Verträge mit Hetzner, Apify und Anthropic abschließen bzw. ablegen; Datenschutzerklärung und Impressum ergänzen.

Hinweis: Die Lead-Suche wartet synchron bis zu 5 Minuten auf Apify. Das funktioniert auf einem VPS, auf Vercel aber nicht ohne Weiteres (Funktions-Timeouts). In Phase 2 ersetzt eine Job-Queue diesen Schritt.

## Sicherheit (umgesetzt)

- Passwörter mit bcrypt gehasht; Login-Sperre nach 5 Fehlversuchen (15 Minuten, In-Memory)
- Session als signiertes JWT im httpOnly-Cookie (SameSite=Lax, Secure in Produktion)
- Rollenprüfung in jeder Server Action; Finanzen und Einstellungen nur für OWNER
- API-Schlüssel verschlüsselt gespeichert und in der Oberfläche nie angezeigt
- Protokoll aller relevanten Aktionen; Security-Header

## Bekannte Grenzen von Phase 1

- Statuswechsel im Kanban per Auswahlfeld statt Drag & Drop; keine Kartenansicht der Leads
- Neue Benutzer werden derzeit nur über das Seed-Skript angelegt
- Lead-Suche ist synchron (siehe oben)
- Die Login-Sperre zählt pro Server-Prozess
- Apify-Kosten sind geschätzt (Free-Tier-Preise × Anzahl Treffer). Die echte Abrechnung steht in der Apify-Konsole
