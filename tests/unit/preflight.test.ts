import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Preflight Check Suite, Husky Pre-Push & CI Shift-Left (Issues #21 & #48)', () => {
  const preflightScriptPath = path.join(process.cwd(), 'scripts/preflight.mjs');
  const preflightShellPath = path.join(process.cwd(), 'scripts/preflight');
  const prePushHookPath = path.join(process.cwd(), '.husky/pre-push');
  const ciWorkflowPath = path.join(process.cwd(), '.github/workflows/ci.yml');
  const docsPath = path.join(process.cwd(), 'docs/PREFLIGHT.md');

  it('scripts/preflight.mjs, scripts/preflight und .husky/pre-push existieren im Repository', () => {
    expect(fs.existsSync(preflightScriptPath)).toBe(true);
    expect(fs.existsSync(preflightShellPath)).toBe(true);
    expect(fs.existsSync(prePushHookPath)).toBe(true);
  });

  it('.husky/pre-push erzwingt scripts/preflight.mjs --stage1 vor jedem Push', () => {
    const hookContent = fs.readFileSync(prePushHookPath, 'utf-8');
    expect(hookContent).toContain('node scripts/preflight.mjs --stage1');
  });

  it('scripts/preflight.mjs fuehrt alle fuenf geforderten Pruefstufen aus und parallelisiert Stage 1', () => {
    const content = fs.readFileSync(preflightScriptPath, 'utf-8');

    // 1. Lint
    expect(content).toContain('lint');
    // 2. TypeScript Compiler Check (tsc --noEmit)
    expect(content).toContain('tsc');
    expect(content).toContain('--noEmit');
    // 3. Unit-Tests
    expect(content).toContain('test:unit');
    // 4. Production Build
    expect(content).toContain('build');
    // 5. Playwright E2E Suite
    expect(content).toContain('test:e2e');
    expect(content).toContain('test:smoke');
    // Parallel execution for Stage 1
    expect(content).toContain('Promise.all');
  });

  it('scripts/preflight.mjs unterstuetzt flexible Flags (--skip-e2e, --stage1, --quick, --e2e-only, --sequential)', () => {
    const content = fs.readFileSync(preflightScriptPath, 'utf-8');

    expect(content).toContain('--skip-e2e');
    expect(content).toContain('--stage1');
    expect(content).toContain('--quick');
    expect(content).toContain('--e2e-only');
    expect(content).toContain('--sequential');
  });

  it('.github/workflows/ci.yml cached node_modules + Prisma Client und parallelisiert Stage 1 & Stage 2', () => {
    expect(fs.existsSync(ciWorkflowPath)).toBe(true);
    const ciContent = fs.readFileSync(ciWorkflowPath, 'utf-8');

    // Preserves required job names
    expect(ciContent).toContain('name: 1. Lint, Typecheck & Unit Tests');
    expect(ciContent).toContain('name: 2. Production Build & Smoke Tests');
    expect(ciContent).toContain('name: 3. Full E2E Tests (Playwright + PostgreSQL)');

    // Caches node_modules and generated Prisma client to skip redundant npm ci on cache hits
    expect(ciContent).toContain('lib/generated/prisma');
    expect(ciContent).toContain("steps.deps-cache.outputs.cache-hit != 'true'");

    // Stage 2 (build-and-smoke) runs in parallel with Stage 1 (does not depend on static-and-unit)
    expect(ciContent).not.toContain('needs: static-and-unit');
    expect(ciContent).toContain('needs: build-and-smoke');
  });

  it('docs/PREFLIGHT.md dokumentiert alle Stufen, Flags, Pre-Push-Hook und Voraussetzungen', () => {
    expect(fs.existsSync(docsPath)).toBe(true);
    const docContent = fs.readFileSync(docsPath, 'utf-8');

    expect(docContent).toContain('npm run lint');
    expect(docContent).toContain('tsc --noEmit');
    expect(docContent).toContain('npm run test:unit');
    expect(docContent).toContain('npm run build');
    expect(docContent).toContain('npm run test:e2e');
    expect(docContent).toContain('--skip-e2e');
    expect(docContent).toContain('.husky/pre-push');
    expect(docContent).toContain('docker compose up -d');
  });

  it('haelt die Schweizer Rechtschreibung (kein Eszett) in allen Preflight- und Hook-Dateien strikt ein', () => {
    const eszett = String.fromCharCode(0xdf);
    const files = [preflightScriptPath, preflightShellPath, prePushHookPath, docsPath];

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      expect(content).not.toContain(eszett);
    }
  });
});
