#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * prüefli (pruefli) Preflight Check Suite
 *
 * Spiegelt die vollstaendige GitHub Actions CI-Pipeline lokal wider:
 * 1. Schweizer Orthografie-Check (kein Eszett)
 * 2. ESLint (npm run lint)
 * 3. TypeScript Type-Check (npx tsc --noEmit)
 * 4. Vitest Unit-Tests (npm run test:unit)
 * 5. Next.js Production Build (npm run build)
 * 6. Playwright E2E- & Smoke-Tests (npm run test:smoke && npm run test:e2e)
 *
 * Stage-1-Checks (ESLint, TypeScript, Vitest) sind voneinander unabhaengig
 * und laufen standardmaessig parallel, um die lokale Pre-Push-Feedbackzeit
 * zu halbieren (via --sequential optional sequenziell ausfuehrbar).
 */

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const WORKSPACE = process.cwd();
const args = process.argv.slice(2);
const skipE2E = args.includes('--skip-e2e');
const stage1Only = args.includes('--stage1') || args.includes('--quick');
const e2eOnly = args.includes('--e2e-only');
const forceSequential = args.includes('--sequential');

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const CHILD_ENV = {
  ...process.env,
  CI: process.env.CI || 'true',
  JWT_SECRET:
    process.env.JWT_SECRET || 'preflight-test-jwt-secret-key-32chars-min',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'preflight-mock-key',
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
    env: CHILD_ENV,
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

function runCommandAsync(cmd, cmdArgs, label) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, {
      cwd: WORKSPACE,
      shell: true,
      env: CHILD_ENV,
    });

    const chunks = [];
    if (child.stdout) {
      child.stdout.on('data', (d) => chunks.push(Buffer.from(d)));
    }
    if (child.stderr) {
      child.stderr.on('data', (d) => chunks.push(Buffer.from(d)));
    }

    child.on('error', (err) => {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      resolve({
        ok: false,
        durationSec,
        exitCode: 1,
        cmdLine: `${cmd} ${cmdArgs.join(' ')}`,
        label,
        output: err.message,
      });
    });

    child.on('close', (code) => {
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const output = Buffer.concat(chunks).toString('utf8');
      resolve({
        ok: code === 0,
        durationSec,
        exitCode: code ?? 1,
        cmdLine: `${cmd} ${cmdArgs.join(' ')}`,
        label,
        output,
      });
    });
  });
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
  const suiteStart = Date.now();
  console.log(
    `${ANSI.bold}${ANSI.cyan}======================================================`
  );
  console.log(`  prüefli (pruefli) Local Preflight Check Suite`);
  console.log(
    `======================================================${ANSI.reset}`
  );

  const stage1ParallelDefs = !e2eOnly
    ? [
        {
          name: 'ESLint Code-Qualitaet',
          cmd: 'npm',
          args: ['run', 'lint'],
          label: 'ESLint',
        },
        {
          name: 'TypeScript Compiler-Check (tsc --noEmit)',
          cmd: 'npx',
          args: ['tsc', '--noEmit'],
          label: 'TypeScript Compiler',
        },
        {
          name: 'Vitest Unit-Tests',
          cmd: 'npm',
          args: ['run', 'test:unit'],
          label: 'Vitest Unit-Tests',
        },
      ]
    : [];

  const sequentialSteps = [];
  if (!stage1Only && !e2eOnly) {
    sequentialSteps.push({
      name: 'Next.js Production Build',
      fn: () =>
        runCommand('npm', ['run', 'build'], 'Next.js Production Build'),
    });
  }

  if (!stage1Only && !skipE2E) {
    sequentialSteps.push({
      name: 'Playwright Smoke-Tests',
      fn: () =>
        runCommand('npm', ['run', 'test:smoke'], 'Playwright Smoke-Tests'),
    });
    sequentialSteps.push({
      name: 'Playwright Full E2E-Tests',
      fn: () => runCommand('npm', ['run', 'test:e2e'], 'Playwright Full E2E'),
    });
  }

  const totalSteps =
    (!e2eOnly ? 1 + stage1ParallelDefs.length : 0) + sequentialSteps.length;

  const results = [];
  let allPassed = true;
  let currentStepIdx = 0;

  if (!e2eOnly) {
    currentStepIdx += 1;
    logHeader(currentStepIdx, totalSteps, 'Schweizer Orthografie');
    const orthoRes = checkOrthography();
    results.push({ name: 'Schweizer Orthografie', ...orthoRes });
    if (!orthoRes.ok) {
      allPassed = false;
    }
  }

  if (allPassed && stage1ParallelDefs.length > 0) {
    if (forceSequential) {
      for (const def of stage1ParallelDefs) {
        currentStepIdx += 1;
        logHeader(currentStepIdx, totalSteps, def.name);
        const res = runCommand(def.cmd, def.args, def.label);
        results.push({ name: def.name, ...res });
        if (!res.ok) {
          allPassed = false;
          break;
        }
      }
    } else {
      console.log(
        `\n${ANSI.cyan}${ANSI.bold}[Stage 1 Parallel] Starte ESLint, TypeScript & Vitest parallel...${ANSI.reset}`
      );
      const parallelOutcomes = await Promise.all(
        stage1ParallelDefs.map((def) =>
          runCommandAsync(def.cmd, def.args, def.label)
        )
      );

      for (let i = 0; i < stage1ParallelDefs.length; i++) {
        const def = stage1ParallelDefs[i];
        const out = parallelOutcomes[i];
        currentStepIdx += 1;
        logHeader(currentStepIdx, totalSteps, def.name);
        console.log(`${ANSI.gray}$ ${out.cmdLine}${ANSI.reset}`);
        if (out.output && out.output.trim()) {
          process.stdout.write(
            out.output.endsWith('\n') ? out.output : `${out.output}\n`
          );
        }
        if (!out.ok) {
          console.error(
            `\n${ANSI.red}${ANSI.bold}❌ ${out.label} fehlgeschlagen (${out.durationSec}s, Exit-Code: ${out.exitCode})${ANSI.reset}\n`
          );
          allPassed = false;
        } else {
          console.log(
            `${ANSI.green}✓ ${out.label} erfolgreich abgeschlossen (${out.durationSec}s)${ANSI.reset}`
          );
        }
        results.push({
          name: def.name,
          ok: out.ok,
          durationSec: out.durationSec,
        });
      }
    }
  }

  if (allPassed) {
    for (const step of sequentialSteps) {
      currentStepIdx += 1;
      logHeader(currentStepIdx, totalSteps, step.name);
      const res = step.fn();
      results.push({ name: step.name, ...res });
      if (!res.ok) {
        allPassed = false;
        break;
      }
    }
  }

  const totalWallSec = ((Date.now() - suiteStart) / 1000).toFixed(2);

  console.log(
    `\n${ANSI.cyan}${ANSI.bold}======================================================`
  );
  console.log(
    `  Zusammenfassung der Preflight-Pruefungen (Gesamt: ${totalWallSec}s)`
  );
  console.log(
    `======================================================${ANSI.reset}`
  );

  for (const r of results) {
    const icon = r.ok
      ? `${ANSI.green}PASS${ANSI.reset}`
      : `${ANSI.red}FAIL${ANSI.reset}`;
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
