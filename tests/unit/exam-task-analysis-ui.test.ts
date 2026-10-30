import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Aufgabenanalyse - UI & API Integration', () => {
  const pagePath = path.join(process.cwd(), 'app/exams/[id]/page.tsx');
  const apiPath = path.join(process.cwd(), 'app/api/exams/[id]/route.ts');
  const taskAnalysisApiPath = path.join(process.cwd(), 'app/api/exams/[id]/task-analysis/route.ts');
  const libPath = path.join(process.cwd(), 'lib/task-analysis.ts');

  const pageContent = fs.readFileSync(pagePath, 'utf-8');
  const apiContent = fs.readFileSync(apiPath, 'utf-8');
  const taskAnalysisApiContent = fs.readFileSync(taskAnalysisApiPath, 'utf-8');
  const libContent = fs.readFileSync(libPath, 'utf-8');

  it('enthaelt den Aufgabenanalyse-Bereich auf der Pruefungsdetailseite', () => {
    expect(pageContent).toContain('Aufgabenanalyse');
    expect(pageContent).toContain('taskAnalysis');
    expect(pageContent).toContain('Basis:');
    expect(pageContent).toContain('korrigierten Arbeiten');
  });

  it('weist nicht zugeordnete Arbeiten und ausgeschlossene Arbeiten transparent aus', () => {
    expect(pageContent).toContain('nicht zugeordnete Arbeiten');
    expect(pageContent).toContain('Ausgeschlossen (noch nicht abgeschlossen):');
    expect(pageContent).toContain('ausstehend');
    expect(pageContent).toContain('in Verarbeitung');
    expect(pageContent).toContain('fehlgeschlagen');
  });

  it('stellt Kennzeichnungen fuer abweichende Maximalpunkte, Null-Maximalpunkte und unsichere KI-Schritte bereit', () => {
    expect(pageContent).toContain('Abweichende Maximalpunkte');
    expect(pageContent).toContain('0 Max. Punkte');
    expect(pageContent).toContain('KI unsicher');
    expect(pageContent).toContain('Nicht bewertet:');
  });

  it('unterstuetzt Teilschritt-Drilldown mit Fehlertypen und Warnung bei variierender Schrittstruktur', () => {
    expect(pageContent).toContain('Teilschritt-Analyse');
    expect(pageContent).toContain('Unterschiedliche Teilschritt-Struktur');
    expect(pageContent).toContain('Rechenfehler');
    expect(pageContent).toContain('Folgefehler');
    expect(pageContent).toContain('Sonstiger Fehler');
  });

  it('zeigt einen aussagekraeftigen Empty-State bei 0 abgeschlossenen Korrekturen', () => {
    expect(pageContent).toContain(
      'Bisher liegen keine abgeschlossenen Korrekturen für diese Prüfung vor'
    );
  });

  it('API /api/exams/[id] und /api/exams/[id]/task-analysis binden computeTaskAnalysis ein', () => {
    expect(apiContent).toContain('computeTaskAnalysis');
    expect(apiContent).toContain('taskAnalysis,');
    expect(taskAnalysisApiContent).toContain('computeTaskAnalysis');
    expect(taskAnalysisApiContent).toContain('taskAnalysis,');
  });

  it('haelt Schweizer Rechtschreibung ein (kein "ß" in benutzersichtbaren Texten und Kommentaren)', () => {
    // lib/task-analysis.ts und task analysis UI duerfen kein "ß" enthalten
    expect(libContent).not.toContain('ß');

    // Aufgabenanalyse-Bereich in page.tsx pruefen
    const startIndex = pageContent.indexOf('2b. Aufgabenanalyse');
    const endIndex = pageContent.indexOf('3. Class Roster Submissions Tracker');
    expect(startIndex).toBeGreaterThan(0);
    expect(endIndex).toBeGreaterThan(startIndex);

    const sectionSlice = pageContent.slice(startIndex, endIndex);
    expect(sectionSlice).not.toContain('ß');
  });
});
