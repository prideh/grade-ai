# prüefli (pruefli) Preflight Check Suite

Die Preflight-Check-Suite spiegelt die vollstaendige GitHub Actions CI-Pipeline lokal wider, damit saemtliche Fehler (Orthografie, Syntax, Typisierung, Tests, Build und E2E) vor dem Push auf `main` erkannt und behoben werden ("Shift Left").

---

## 🎯 Zweck & Motivation

In CI prueft GitHub Actions jede Aenderung in drei Stufen (wobei Stage 1 und Stage 2 parallel starten):

1. **Stage 1 (Lint, Typecheck & Unit Tests):** Schweizer Orthografie, ESLint, `npx tsc --noEmit`, Vitest.
2. **Stage 2 (Production Build & Smoke Tests):** `npm run build`, Smoke-Tests gegen den Produktionsserver.
3. **Stage 3 (Full E2E Tests):** Playwright E2E-Tests gegen PostgreSQL-Datenbank (nutzt das `.next`-Build-Artefakt aus Stage 2).

Damit fehlerhafte Commits gar nicht erst in die CI gelangen, erzwingt der Git-Hook `.husky/pre-push` automatisch `node scripts/preflight.mjs --stage1` vor jedem `git push`.

---

## 🔒 Automatischer Pre-Push Hook (`.husky/pre-push`)

Bei jedem `git push` fuehrt Husky automatisch Stage 1 der Preflight-Suite aus:

```bash
node scripts/preflight.mjs --stage1
```

- **Orthografie-Check (~0.06s):** Sofortiger Abbruch bei verbotenem Eszett.
- **Parallele Ausfuehrung (~14s):** ESLint (`npm run lint`), TypeScript (`npx tsc --noEmit`) und Vitest (`npm run test:unit`) laufen parallel, um die lokale Wartezeit vor dem Push zu halbieren.
- Schlaegt eine Pruefung fehl, wird der Push mit Exit-Code `1` abgebrochen.

---

## 🚀 Manueller Aufruf

### Vollstaendiger Preflight (Standard)

```bash
node scripts/preflight.mjs
# oder auf Linux / macOS / WSL:
./scripts/preflight
```

Fuehrt alle Stufen aus:

1. **Schweizer Orthografie:** Prueft, dass kein Eszett im Quellcode vorkommt (strikte Einhaltung der Schweizer Rechtschreibung mit `ss`).
2. **ESLint (`npm run lint`):** Prueft Code-Qualitaet, ungenutzte Variablen und Formatierungsregeln.
3. **TypeScript Compiler (`npx tsc --noEmit`):** Vollstaendiger statischer Typ-Check ueber das gesamte Projekt.
4. **Unit-Tests (`npm run test:unit`):** Vitest Test-Suite fuer API-Routen, Hilfsfunktionen, Kryptografie und UI-Komponenten.
5. **Production Build (`npm run build`):** Next.js Turbopack Produktions-Build inklusive Prerendering und SSR-Validierung.
6. **Playwright Smoke- & E2E-Tests (`npm run test:smoke` & `npm run test:e2e`):** Vollstaendige Browser-Tests mit End-to-End-Benutzerablaeufen.

---

## ⚙️ Optionen & Flags

| Flag                      | Beschreibung                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| _(keine)_                 | Vollstaendiger Lauf (Orthografie, Lint, Typecheck, Unit-Tests, Build, Smoke, E2E).                    |
| `--stage1` oder `--quick` | Schneller Pre-Push Gate-Check (~14s parallel): Orthografie, Lint, `tsc --noEmit` und Unit-Tests.      |
| `--sequential`            | Fuehrt die Stage-1-Checks nacheinander statt parallel aus.                                            |
| `--skip-e2e`              | Fuehrt Orthografie, Lint, Typecheck, Unit-Tests und Production Build aus, ueberspringt Browser-Tests. |
| `--e2e-only`              | Fuehrt ausschliesslich die Playwright Smoke- und E2E-Tests aus.                                       |

---

## 📋 Voraussetzungen fuer Playwright E2E

Fuer die Ausfuehrung der vollstaendigen E2E-Tests (Stufe 6) wird eine laufende PostgreSQL-Instanz benoetigt:

```bash
# Lokale PostgreSQL-Datenbank via Docker starten
docker compose up -d

# Schema synchronisieren & Baselines einspielen
npx prisma db push
npx prisma db seed
```
