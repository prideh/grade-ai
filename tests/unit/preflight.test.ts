import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Preflight Check Suite & Documentation (Issue #21)', () => {
  const preflightScriptPath = path.join(process.cwd(), 'scripts/preflight.mjs');
  const preflightShellPath = path.join(process.cwd(), 'scripts/preflight');
  const docsPath = path.join(process.cwd(), 'docs/PREFLIGHT.md');

  it('scripts/preflight.mjs und scripts/preflight existieren im Repository', () => {
    expect(fs.existsSync(preflightScriptPath)).toBe(true);
    expect(fs.existsSync(preflightShellPath)).toBe(true);
  });

  it('scripts/preflight.mjs fuehrt alle fuenf geforderten Pruefstufen aus', () => {
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
  });

  it('scripts/preflight.mjs unterstuetzt flexible Flags (--skip-e2e, --stage1, --quick, --e2e-only)', () => {
    const content = fs.readFileSync(preflightScriptPath, 'utf-8');

    expect(content).toContain('--skip-e2e');
    expect(content).toContain('--stage1');
    expect(content).toContain('--quick');
    expect(content).toContain('--e2e-only');
  });

  it('docs/PREFLIGHT.md dokumentiert alle Stufen, Flags und Voraussetzungen', () => {
    expect(fs.existsSync(docsPath)).toBe(true);
    const docContent = fs.readFileSync(docsPath, 'utf-8');

    expect(docContent).toContain('npm run lint');
    expect(docContent).toContain('tsc --noEmit');
    expect(docContent).toContain('npm run test:unit');
    expect(docContent).toContain('npm run build');
    expect(docContent).toContain('npm run test:e2e');
    expect(docContent).toContain('--skip-e2e');
    expect(docContent).toContain('docker compose up -d');
  });

  it('haelt die Schweizer Rechtschreibung (kein Eszett) in allen Preflight-Dateien strikt ein', () => {
    const eszett = String.fromCharCode(0xdf);
    const files = [preflightScriptPath, preflightShellPath, docsPath];

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf-8');
      expect(content).not.toContain(eszett);
    }
  });
});
