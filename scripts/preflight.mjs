#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * GradeAI Preflight Check Suite
 *
 * Spiegelt die vollstaendige GitHub Actions CI-Pipeline lokal wider:
 * 1. Schweizer Orthografie-Check (kein Eszett)
 * 2. ESLint (npm run lint)
 * 3. TypeScript Type-Check (npx tsc --noEmit)
 * 4. Vitest Unit-Tests (npm run test:unit)
 * 5. Next.js Production Build (npm run build)
 * 6. Playwright E2E- & Smoke-Tests (npm run test:smoke && npm run test:e2e)
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const WORKSPACE = process.cwd();
const args = process.argv.slice(2);
const skipE2E = args.includes('--skip-e2e');
const stage1Only = args.includes('--stage1') || args.includes('--quick');
const e2eOnly = args.includes('--e2e-only');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function logHeader(stepNum, totalSteps, title) {
  console.log(
    `\n${ANSI.cyan}${ANSI.bold}[${stepNum}/${totalSteps}] ${title}${ANSI.reset}`
  );
  console.log(`${ANSI.gray}${'—'.repeat(60)}${ANSI.reset}`);
}

function runCommand(cmd, cmdArgs, label) {
  const startTime = Date.now();
  console.log(`${ANSI.gray}$ ${cmd} ${cmdArgs.join(' ')}${ANSI.reset}`);

  const res = spawnSync(cmd, cmdArgs, {
    cwd: WORKSPACE,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CI: process.env.CI || 'true',
      JWT_SECRET:
        process.env.JWT_SECRET || 'preflight-test-jwt-secret-key-32chars-min',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'preflight-mock-key',
    },
  });

  const durationMs = Date.now() - startTime;
  const durationSec = (durationMs / 1000).toFixed(2);

  if (res.status !== 0) {
    console.error(
      `\n${ANSI.red}${ANSI.bold}❌ ${label} fehlgeschlagen (${durationSec}s, Exit-Code: ${res.status})${ANSI.reset}\n`
    );
    return { ok: false, durationSec };
  }

  console.log(
    `${ANSI.green}✓ ${label} erfolgreich abgeschlossen (${durationSec}s)${ANSI.reset}`
  );
  return { ok: true, durationSec };
}

function checkOrthography() {
  const startTime = Date.now();
  console.log(
    `${ANSI.gray}$ Pruefe Schweizer Rechtschreibung (kein Eszett)...${ANSI.reset}`
  );

  const targets = ['app', 'components', 'lib', 'prisma', 'proxy.ts', 'scripts'];
  const eszettChar = String.fromCharCode(0xdf);
  const violations = [];

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const stat = fs.statSync(dir);
    if (stat.isFile()) {
      const content = fs.readFileSync(dir, 'utf8');
      if (content.includes(eszettChar)) {
        violations.push(path.relative(WORKSPACE, dir));
      }
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === '.git'
      ) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (/\.(ts|tsx|js|mjs|jsx|css|json|md)$/.test(entry.name)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes(eszettChar)) {
          violations.push(path.relative(WORKSPACE, fullPath));
        }
      }
    }
  }

  for (const t of targets) {
    scanDir(path.join(WORKSPACE, t));
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  if (violations.length > 0) {
    console.error(
      `\n${ANSI.red}${ANSI.bold}❌ Schweizer Orthografie verletzt: Eszett gefunden in:${ANSI.reset}`
    );
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    console.error(
      `${ANSI.yellow}Gemaess Richtlinien muss immer "ss" statt Eszett verwendet werden.${ANSI.reset}\n`
    );
    return { ok: false, durationSec };
  }

  console.log(
    `${ANSI.green}✓ Schweizer Orthografie eingehalten (kein Eszett gefunden, ${durationSec}s)${ANSI.reset}`
  );
  return { ok: true, durationSec };
}

async function main() {
  console.log(
    `${ANSI.bold}${ANSI.cyan}======================================================`
  );
  console.log(`  GradeAI Local Preflight Check Suite`);
  console.log(
    `======================================================${ANSI.reset}`
  );

  const steps = [];

  if (!e2eOnly) {
    steps.push({
      name: 'Schweizer Orthografie',
      fn: () => checkOrthography(),
    });
    steps.push({
      name: 'ESLint Code-Qualitaet',
      fn: () => runCommand('npm', ['run', 'lint'], 'ESLint'),
    });
    steps.push({
      name: 'TypeScript Compiler-Check (tsc --noEmit)',
      fn: () => runCommand('npx', ['tsc', '--noEmit'], 'TypeScript Compiler'),
    });
    steps.push({
      name: 'Vitest Unit-Tests',
      fn: () => runCommand('npm', ['run', 'test:unit'], 'Vitest Unit-Tests'),
    });
  }

  if (!stage1Only && !e2eOnly) {
    steps.push({
      name: 'Next.js Production Build',
      fn: () =>
        runCommand('npm', ['run', 'build'], 'Next.js Production Build'),
    });
  }

  if (!stage1Only && !skipE2E) {
    steps.push({
      name: 'Playwright Smoke-Tests',
      fn: () =>
        runCommand('npm', ['run', 'test:smoke'], 'Playwright Smoke-Tests'),
    });
    steps.push({
      name: 'Playwright Full E2E-Tests',
      fn: () => runCommand('npm', ['run', 'test:e2e'], 'Playwright Full E2E'),
    });
  }

  const results = [];
  let allPassed = true;

  for (let idx = 0; idx < steps.length; idx++) {
    const step = steps[idx];
    logHeader(idx + 1, steps.length, step.name);
    const res = step.fn();
    results.push({ name: step.name, ...res });
    if (!res.ok) {
      allPassed = false;
      break;
    }
  }

  console.log(
    `\n${ANSI.cyan}${ANSI.bold}======================================================`
  );
  console.log(`  Zusammenfassung der Preflight-Pruefungen`);
  console.log(
    `======================================================${ANSI.reset}`
  );

  for (const r of results) {
    const icon = r.ok ? `${ANSI.green}PASS${ANSI.reset}` : `${ANSI.red}FAIL${ANSI.reset}`;
    console.log(`  [${icon}] ${r.name.padEnd(45)} (${r.durationSec}s)`);
  }

  if (!allPassed) {
    console.error(
      `\n${ANSI.red}${ANSI.bold}Preflight FEHLGESCHLAGEN. Bitte behebe die obigen Fehler vor dem Push.${ANSI.reset}\n`
    );
    process.exit(1);
  }

  console.log(
    `\n${ANSI.green}${ANSI.bold}Alle Preflight-Pruefungen ERFOLGREICH abgeschlossen! Commit ist bereit fuer CI.${ANSI.reset}\n`
  );
  process.exit(0);
}

main();
