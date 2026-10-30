import { describe, it, expect } from 'vitest';
import { computeTaskAnalysis, RawExamTask, RawSubmission } from '@/lib/task-analysis';

describe('Aufgabenanalyse - computeTaskAnalysis', () => {
  const sampleTasks: RawExamTask[] = [
    {
      id: 'task-1',
      taskId: '1',
      title: 'Aufgabe 1: Lineare Gleichungen',
      maxPoints: 10,
      orderIndex: 0,
    },
    {
      id: 'task-2',
      taskId: '2',
      title: 'Aufgabe 2: Quadratische Funktionen',
      maxPoints: 15,
      orderIndex: 1,
    },
    { id: 'task-3', taskId: '3', title: 'Aufgabe 3: Bonusfrage', maxPoints: 0, orderIndex: 2 },
  ];

  it('berechnet die Basis korrekt und schliesst PENDING/FAILED Arbeiten aus', () => {
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 8,
            maximalPunkte: 10,
            status: 'Korrekt',
          },
          {
            taskId: '2',
            title: 'Aufgabe 2',
            erzieltePunkte: 12,
            maximalPunkte: 15,
            status: 'Folgefehler',
          },
        ],
      },
      {
        id: 'sub-2',
        status: 'COMPLETED',
        studentId: null, // Unmatched
        extractedStudentName: 'Anna M.',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 6,
            maximalPunkte: 10,
            status: 'Fehler',
          },
          {
            taskId: '2',
            title: 'Aufgabe 2',
            erzieltePunkte: 9,
            maximalPunkte: 15,
            status: 'Fehler',
          },
        ],
      },
      { id: 'sub-3', status: 'PENDING', studentId: 'stud-3' },
      { id: 'sub-4', status: 'PROCESSING', studentId: 'stud-4' },
      { id: 'sub-5', status: 'FAILED', studentId: 'stud-5' },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);

    expect(result.totalSubmissions).toBe(5);
    expect(result.completedSubmissionsCount).toBe(2);
    expect(result.excludedSubmissionsCount).toBe(3);
    expect(result.excludedBreakdown.pending).toBe(1);
    expect(result.excludedBreakdown.processing).toBe(1);
    expect(result.excludedBreakdown.failed).toBe(1);
    expect(result.unmatchedCompletedCount).toBe(1);

    // Aufgabe 1: 8 + 6 = 14 / 2 = 7.0 Punkte (70.0 %)
    const a1 = result.tasks.find((t) => t.taskId === '1')!;
    expect(a1.gradedCount).toBe(2);
    expect(a1.ungradedCount).toBe(0);
    expect(a1.avgPoints).toBe(7);
    expect(a1.avgPercent).toBe(70);
    expect(a1.statusDistribution.korrekt).toBe(1);
    expect(a1.statusDistribution.fehler).toBe(1);
    expect(a1.statusDistribution.folgefehler).toBe(0);
  });

  it('behandelt fehlende TaskCorrections als "nicht bewertet" und verfaelscht den Schnitt nicht', () => {
    // 3 COMPLETED Submissions, aber nur 2 haben Aufgabe 2 bearbeitet
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 10,
            maximalPunkte: 10,
            status: 'Korrekt',
          },
          {
            taskId: '2',
            title: 'Aufgabe 2',
            erzieltePunkte: 15,
            maximalPunkte: 15,
            status: 'Korrekt',
          },
        ],
      },
      {
        id: 'sub-2',
        status: 'COMPLETED',
        studentId: 'stud-2',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 8,
            maximalPunkte: 10,
            status: 'Korrekt',
          },
          // Keine Aufgabe 2!
        ],
      },
      {
        id: 'sub-3',
        status: 'COMPLETED',
        studentId: 'stud-3',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 6,
            maximalPunkte: 10,
            status: 'Fehler',
          },
          {
            taskId: '2',
            title: 'Aufgabe 2',
            erzieltePunkte: 9,
            maximalPunkte: 15,
            status: 'Folgefehler',
          },
        ],
      },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);

    const a2 = result.tasks.find((t) => t.taskId === '2')!;
    expect(a2.gradedCount).toBe(2);
    expect(a2.ungradedCount).toBe(1); // 1 submission nicht bewertet
    // Schnitt: (15 + 9) / 2 = 12.0 Punkte (80.0%), NICHT (15 + 0 + 9) / 3 = 8.0!
    expect(a2.avgPoints).toBe(12);
    expect(a2.avgPercent).toBe(80);
    expect(a2.statusDistribution.korrekt).toBe(1);
    expect(a2.statusDistribution.folgefehler).toBe(1);
    expect(a2.statusDistribution.fehler).toBe(0);
  });

  it('Null-Guard: verhindert NaN/Infinity wenn canonical maxPoints === 0', () => {
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          {
            taskId: '3',
            title: 'Bonusfrage',
            erzieltePunkte: 2,
            maximalPunkte: 0,
            status: 'Korrekt',
          },
        ],
      },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);
    const a3 = result.tasks.find((t) => t.taskId === '3')!;

    expect(a3.isZeroMaxPoints).toBe(true);
    expect(a3.avgPoints).toBe(2);
    expect(a3.avgPercent).toBeNull(); // Kein NaN oder Infinity!
  });

  it('erkennt Abweichungen der Maximalpunkte von der Aufgabenvorlage', () => {
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          // Vorlage ist 10, aber hier wurden 12 Punkte vergeben
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 10,
            maximalPunkte: 12,
            status: 'Korrekt',
          },
        ],
      },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);
    const a1 = result.tasks.find((t) => t.taskId === '1')!;

    expect(a1.hasMaxPointsDeviation).toBe(true);
  });

  it('aggregiert Teilschritte, Fehlerarten und unsichere Schritte im Drill-Down', () => {
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 7,
            maximalPunkte: 10,
            status: 'Folgefehler',
            schritte: [
              {
                schrittIndex: 0,
                schrittText: 'Term umformen',
                istKorrekt: true,
                fehlerTyp: 'KeinFehler',
                erreichtePunkte: 4,
                maximalPunkte: 4,
                istUnsicher: false,
              },
              {
                schrittIndex: 1,
                schrittText: 'Nach x aufloesen',
                istKorrekt: false,
                fehlerTyp: 'Rechenfehler',
                erreichtePunkte: 3,
                maximalPunkte: 6,
                istUnsicher: true,
              },
            ],
          },
        ],
      },
      {
        id: 'sub-2',
        status: 'COMPLETED',
        studentId: 'stud-2',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 8,
            maximalPunkte: 10,
            status: 'Folgefehler',
            schritte: [
              {
                schrittIndex: 0,
                schrittText: 'Term umformen',
                istKorrekt: true,
                fehlerTyp: 'KeinFehler',
                erreichtePunkte: 4,
                maximalPunkte: 4,
                istUnsicher: false,
              },
              {
                schrittIndex: 1,
                schrittText: 'Nach x aufloesen',
                istKorrekt: false,
                fehlerTyp: 'Folgefehler',
                erreichtePunkte: 4,
                maximalPunkte: 6,
                istUnsicher: false,
              },
            ],
          },
        ],
      },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);
    const a1 = result.tasks.find((t) => t.taskId === '1')!;

    expect(a1.hasSteps).toBe(true);
    expect(a1.hasVaryingStepStructure).toBe(false);
    expect(a1.uncertainStepsCount).toBe(1);
    expect(a1.steps).toHaveLength(2);

    const step0 = a1.steps[0];
    expect(step0.schrittIndex).toBe(0);
    expect(step0.errorCounts.KeinFehler).toBe(2);
    expect(step0.avgErreichtePunkte).toBe(4);
    expect(step0.avgMaximalPunkte).toBe(4);
    expect(step0.uncertainCount).toBe(0);

    const step1 = a1.steps[1];
    expect(step1.schrittIndex).toBe(1);
    expect(step1.errorCounts.Rechenfehler).toBe(1);
    expect(step1.errorCounts.Folgefehler).toBe(1);
    expect(step1.avgErreichtePunkte).toBe(3.5); // (3 + 4) / 2
    expect(step1.avgMaximalPunkte).toBe(6);
    expect(step1.uncertainCount).toBe(1);
  });

  it('erkennt variierende Schrittstrukturen zwischen Arbeiten', () => {
    const submissions: RawSubmission[] = [
      {
        id: 'sub-1',
        status: 'COMPLETED',
        studentId: 'stud-1',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 10,
            maximalPunkte: 10,
            status: 'Korrekt',
            schritte: [
              { schrittIndex: 0, fehlerTyp: 'KeinFehler', erreichtePunkte: 5, maximalPunkte: 5 },
              { schrittIndex: 1, fehlerTyp: 'KeinFehler', erreichtePunkte: 5, maximalPunkte: 5 },
            ],
          },
        ],
      },
      {
        id: 'sub-2',
        status: 'COMPLETED',
        studentId: 'stud-2',
        tasks: [
          {
            taskId: '1',
            title: 'Aufgabe 1',
            erzieltePunkte: 10,
            maximalPunkte: 10,
            status: 'Korrekt',
            schritte: [
              // Nur 1 Schritt statt 2!
              { schrittIndex: 0, fehlerTyp: 'KeinFehler', erreichtePunkte: 10, maximalPunkte: 10 },
            ],
          },
        ],
      },
    ];

    const result = computeTaskAnalysis(sampleTasks, submissions);
    const a1 = result.tasks.find((t) => t.taskId === '1')!;

    expect(a1.hasVaryingStepStructure).toBe(true);
  });

  it('liefert leere Kennzahlen, wenn keine COMPLETED Submissions vorhanden sind', () => {
    const submissions: RawSubmission[] = [{ id: 'sub-1', status: 'PENDING', studentId: 'stud-1' }];

    const result = computeTaskAnalysis(sampleTasks, submissions);

    expect(result.completedSubmissionsCount).toBe(0);
    expect(result.excludedSubmissionsCount).toBe(1);
    expect(result.tasks[0].gradedCount).toBe(0);
    expect(result.tasks[0].avgPoints).toBeNull();
    expect(result.tasks[0].avgPercent).toBeNull();
  });
});
