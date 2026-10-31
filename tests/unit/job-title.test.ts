import { describe, it, expect } from 'vitest';
import { getDashboardJobTitle } from '@/lib/job-title';

describe('Dashboard Job Card Title Logic (lib/job-title.ts)', () => {
  it('formats failed unassigned jobs without "läuft" text', () => {
    const title = getDashboardJobTitle({
      studentName: 'Nicht zugeordnet',
      examTitle: 'Demo-Prüfung: Teil 1',
      className: 'Demoklasse 3a',
      status: 'FAILED',
    });

    expect(title).toBe('Korrektur fehlgeschlagen (Demo-Prüfung) (Demoklasse 3a)');
    expect(title).not.toContain('läuft');
  });

  it('keeps "🤖 Auto-Match läuft..." for processing unassigned jobs', () => {
    const title = getDashboardJobTitle({
      studentName: 'Nicht zugeordnet',
      examTitle: 'Demo-Prüfung: Teil 1',
      className: 'Demoklasse 3a',
      status: 'PROCESSING',
    });

    expect(title).toBe('🤖 Auto-Match läuft... (Demo-Prüfung) (Demoklasse 3a)');
    expect(title).toContain('Auto-Match läuft...');
  });

  it('keeps "🤖 Auto-Match läuft..." for pending unassigned jobs', () => {
    const title = getDashboardJobTitle({
      studentName: 'Nicht zugeordnet',
      examTitle: 'Demo-Prüfung',
      className: 'Demoklasse 3a',
      status: 'PENDING',
    });

    expect(title).toBe('🤖 Auto-Match läuft... (Demo-Prüfung) (Demoklasse 3a)');
    expect(title).toContain('Auto-Match läuft...');
  });

  it('leaves completed unassigned jobs unchanged in standard format', () => {
    const title = getDashboardJobTitle({
      studentName: 'Nicht zugeordnet',
      examTitle: 'Demo-Prüfung: Teil 1',
      className: 'Demoklasse 3a',
      status: 'COMPLETED',
    });

    expect(title).toBe('Nicht zugeordnet — Demo-Prüfung: Teil 1 (Demoklasse 3a)');
    expect(title).not.toContain('läuft');
  });

  it('leaves assigned jobs unchanged regardless of status', () => {
    const baseJob = {
      studentName: 'Lukas Müller',
      examTitle: 'Mathematik Prüfung 1',
      className: 'Klasse 3a',
    };

    expect(getDashboardJobTitle({ ...baseJob, status: 'FAILED' })).toBe(
      'Lukas Müller — Mathematik Prüfung 1 (Klasse 3a)'
    );
    expect(getDashboardJobTitle({ ...baseJob, status: 'PROCESSING' })).toBe(
      'Lukas Müller — Mathematik Prüfung 1 (Klasse 3a)'
    );
    expect(getDashboardJobTitle({ ...baseJob, status: 'PENDING' })).toBe(
      'Lukas Müller — Mathematik Prüfung 1 (Klasse 3a)'
    );
    expect(getDashboardJobTitle({ ...baseJob, status: 'COMPLETED' })).toBe(
      'Lukas Müller — Mathematik Prüfung 1 (Klasse 3a)'
    );
  });
});
