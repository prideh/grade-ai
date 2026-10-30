import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UX Form Details Improvements', () => {
  it('Registrierungsseite zeigt Passwort-Regel (mindestens 6 Zeichen) direkt am Feld an', () => {
    const registerFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/register/page.tsx'),
      'utf-8'
    );
    expect(registerFile).toContain('helperText="Mindestens 6 Zeichen erforderlich');
  });

  it('Dashboard zeigt bei deaktiviertem Start-Button fehlende Voraussetzungen an', () => {
    const dashboardFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/dashboard/page.tsx'),
      'utf-8'
    );
    expect(dashboardFile).toContain('missingRequirements');
    expect(dashboardFile).toContain('Noch erforderlich, um die Korrektur zu starten:');
    expect(dashboardFile).toContain('Prüfungstitel angeben');
    expect(dashboardFile).toContain('Musterlösung hinterlegen');
  });

  it('Prüfungsdialog erklaert die Bedeutung von Stufe 3 verstaendlich', () => {
    const examsFile = fs.readFileSync(path.resolve(__dirname, '../../app/exams/page.tsx'), 'utf-8');
    expect(examsFile).toContain('Stufe 3 der KI-Korrektur: Individuelle Bewertungsregeln');

    const examDetailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/exams/[id]/page.tsx'),
      'utf-8'
    );
    expect(examDetailFile).toContain('Stufe 3 der KI-Korrektur: Individuelle Bewertungsregeln');
    expect(examDetailFile).toContain('Stufe 3: Individueller Korrekturkontext');
  });

  it('Klassennamen-Aenderungsdialog synchronisiert den aktuellen Klassennamen (Prefill)', () => {
    const classDetailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/[id]/page.tsx'),
      'utf-8'
    );
    expect(classDetailFile).toContain("setEditedClassName(classData?.name || '')");
  });
});
