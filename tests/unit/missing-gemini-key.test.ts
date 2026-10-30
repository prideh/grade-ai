import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Missing Gemini API Key Error Handling (Issue #16)', () => {
  const correctRoutePath = path.join(process.cwd(), 'app/api/correct/route.ts');
  const parseRubricRoutePath = path.join(process.cwd(), 'app/api/exams/parse-rubric/route.ts');

  const correctContent = fs.readFileSync(correctRoutePath, 'utf-8');
  const parseRubricContent = fs.readFileSync(parseRubricRoutePath, 'utf-8');

  it('gibt keinen entwickler-zentrierten Hinweis auf .env.local mehr aus', () => {
    expect(correctContent).not.toContain('.env.local');
    expect(parseRubricContent).not.toContain('.env.local');
  });

  it('erlaeutert verstaendlich, dass der API-Schluessel auf dem Server nicht konfiguriert ist', () => {
    expect(correctContent).toContain('Gemini API-Schlüssel ist auf dem Server nicht konfiguriert.');
    expect(parseRubricContent).toContain(
      'Gemini API-Schlüssel ist auf dem Server nicht konfiguriert.'
    );
  });

  it('verwendet einen Statuscode der 5xx-Familie statt 401 bei fehlendem API-Schluessel', () => {
    // Stellt sicher, dass bei fehlendem apiKey nicht 401, sondern 500 (5xx) zurueckgegeben wird
    const apiKeyBlockRegex = /if\s*\(!apiKey\)\s*\{[\s\S]*?status:\s*(5\d{2})\s*\}/;
    const match = correctContent.match(apiKeyBlockRegex);
    expect(match).not.toBeNull();
    const statusCode = parseInt(match![1], 10);
    expect(statusCode).toBeGreaterThanOrEqual(500);
    expect(statusCode).toBeLessThan(600);
  });

  it('prueft den API-Schluessel vor Datenbankoperationen ab', () => {
    const apiKeyCheckIndex = correctContent.indexOf('if (!apiKey)');
    const dbWriteIndex = correctContent.indexOf('await db.');
    expect(apiKeyCheckIndex).toBeGreaterThan(0);
    expect(dbWriteIndex).toBeGreaterThan(apiKeyCheckIndex);
  });

  it('haelt Schweizer Rechtschreibung ein (kein "ß")', () => {
    expect(correctContent).not.toContain('ß');
    expect(parseRubricContent).not.toContain('ß');
  });
});
