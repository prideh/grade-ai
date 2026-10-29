import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UX Language & Tone Consistency', () => {
  it('die Landing-Page verwendet die einheitliche Du-Form statt Sie', () => {
    const landingFile = fs.readFileSync(path.resolve(__dirname, '../../app/page.tsx'), 'utf-8');
    expect(landingFile).toContain('Spare bis zu 80% deiner Korrekturzeit.');
    expect(landingFile).not.toContain('Sparen Sie bis zu 80% Ihrer Korrekturzeit.');
  });

  it('im UI wird Klassenliste statt Roster verwendet', () => {
    const classesFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/page.tsx'),
      'utf-8'
    );
    expect(classesFile).toContain('Details & Klassenliste');
    expect(classesFile).not.toContain('Details & Roster');

    const classDetailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/[id]/page.tsx'),
      'utf-8'
    );
    expect(classDetailFile).toContain('Klassenliste (Schüler/innen)');
    expect(classDetailFile).not.toContain('Klassen-Roster');
  });

  it('im UI wird Mehrfach-Upload statt Bulk-Upload verwendet', () => {
    const dashboardFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/dashboard/page.tsx'),
      'utf-8'
    );
    expect(dashboardFile).toContain('Mehrfach-Upload');
    expect(dashboardFile).not.toContain('Bulk-Upload');
  });

  it('im UI wird KI-Rückmeldungen statt AI-Feedbacks verwendet', () => {
    const submissionsFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/submissions/page.tsx'),
      'utf-8'
    );
    expect(submissionsFile).toContain('KI-Rückmeldungen');
    expect(submissionsFile).not.toContain('AI-Feedbacks');

    const examDetailFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/exams/[id]/page.tsx'),
      'utf-8'
    );
    expect(examDetailFile).toContain('KI-Rückmeldungen');
    expect(examDetailFile).not.toContain('AI-Feedbacks');
  });

  it('Feldbezeichnung und Validierungsfehler der Klasse sind aufeinander abgestimmt (Klassenname)', () => {
    const classesFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/page.tsx'),
      'utf-8'
    );
    expect(classesFile).toContain('label="Klassenname"');
    expect(classesFile).not.toContain('label="Klassenbezeichnung"');
    expect(classesFile).toContain('Bitte gib einen Klassennamen an.');
  });
});
