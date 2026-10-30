# GradeAI Preflight Check Suite

Die Preflight-Check-Suite spiegelt die vollstaendige GitHub Actions CI-Pipeline lokal wider, damit saemtliche Fehler (Syntax, Typisierung, Tests, Build und E2E) vor dem Push auf `main` erkannt und behoben werden.

---

## 🎯 Zweck & Motivation

In CI prueft GitHub Actions jede Aenderung in drei aufeinanderfolgenden Stufen:

1. **Stage 1 (Lint, Typecheck & Unit Tests):** Orthografie, ESLint, `npx tsc --noEmit`, Vitest.
2. **Stage 2 (Production Build & Smoke Tests):** `npm run build`, Smoke-Tests gegen den Produktionsserver.
3. **Stage 3 (Full E2E Tests):** Playwright E2E-Tests gegen PostgreSQL-Datenbank.

Wird ein Commit gepusht, der bereits im lokalen Type-Check oder Linter scheitert, blockiert dies unnoetig die CI-Queue und erzeugt Fehlalarme. Die Preflight-Suite fuehrt exakt dieselben Checks lokal aus.

---

## 🚀 Aufruf

### Vollstaendiger Preflight (Standard)

```bash
node scripts/preflight.mjs
# oder auf Linux / macOS / WSL:
./scripts/preflight
```

Fuehrt alle Stufen nacheinander aus:

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
| `--stage1` oder `--quick` | Schneller Gate-Check (~15s): Orthografie, Lint, `tsc --noEmit` und Unit-Tests.                        |
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

---

## 🔒 Scope & Abgrenzung (Issue #21 / #20)

- **Repository-Scope:** Das Skript `scripts/preflight.mjs`, der Shell-Wrapper `scripts/preflight` und diese Dokumentation gehoeren zum Repository.
- **Control-Plane-Scope:** Die automatische Verdrahtung des Preflight-Gates in den Sidecar-Broker (vor dem Git-Push) ist geschuetzter Kontrollcode (#20) und wird separat gepflegt.
