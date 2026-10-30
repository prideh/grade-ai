/**
 * Logik zur Aggregation der Aufgabenanalyse (Feature: Aufgabenanalyse fuer Pruefungen).
 *
 * Beachtet strikt alle fachlichen Regeln:
 * - Nur COMPLETED-Arbeiten fliessen in die Kennzahlen ein.
 * - Submissions ohne TaskCorrection gelten als 'nicht bewertet' und verfaelschen den Schnitt nicht als 0 Punkte.
 * - Null-Guard fuer maxPoints === 0 (verhindert NaN / Infinity).
 * - Kennzeichnung abweichender Maximalpunkte (TaskCorrection.maximalPunkte !== ExamTask.maxPoints).
 * - Pruefung auf variierende Teilschritt-Strukturen ueber Submissions hinweg.
 * - Erfassung unsicherer Teilschritte (istUnsicher = true).
 * - Separate Ausweisung nicht zugeordneter Arbeiten (studentId == null).
 * - Schweizer Rechtschreibung (immer "ss", niemals Eszett).
 */

export interface RawStepCorrection {
  id?: string;
  schrittIndex: number;
  schrittText?: string | null;
  istKorrekt?: boolean;
  fehlerTyp: 'KeinFehler' | 'Rechenfehler' | 'Folgefehler' | 'SonstigerFehler' | string;
  erreichtePunkte: number;
  maximalPunkte: number;
  istUnsicher?: boolean;
  unsicherheitsGrund?: string | null;
}

export interface RawTaskCorrection {
  id?: string;
  taskId: string;
  title: string;
  erzieltePunkte: number;
  maximalPunkte: number;
  status: 'Korrekt' | 'Folgefehler' | 'Fehler' | string;
  orderIndex?: number;
  schritte?: RawStepCorrection[];
}

export interface RawSubmission {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  studentId?: string | null;
  extractedStudentName?: string | null;
  tasks?: RawTaskCorrection[];
}

export interface RawExamTask {
  id?: string;
  taskId: string;
  title: string;
  maxPoints: number;
  orderIndex: number;
}

export interface StepAnalysis {
  schrittIndex: number;
  schrittText: string;
  count: number;
  errorCounts: {
    KeinFehler: number;
    Rechenfehler: number;
    Folgefehler: number;
    SonstigerFehler: number;
  };
  avgErreichtePunkte: number;
  avgMaximalPunkte: number;
  uncertainCount: number;
}

export interface TaskAnalysisItem {
  id: string;
  taskId: string;
  title: string;
  orderIndex: number;
  canonicalMaxPoints: number;

  gradedCount: number;
  ungradedCount: number;

  avgPoints: number | null;
  avgPercent: number | null;

  statusDistribution: {
    korrekt: number;
    folgefehler: number;
    fehler: number;
  };

  hasMaxPointsDeviation: boolean;
  isZeroMaxPoints: boolean;

  hasSteps: boolean;
  hasVaryingStepStructure: boolean;
  uncertainStepsCount: number;
  steps: StepAnalysis[];
}

export interface ExamTaskAnalysis {
  totalSubmissions: number;
  completedSubmissionsCount: number;
  excludedSubmissionsCount: number;
  excludedBreakdown: {
    pending: number;
    processing: number;
    failed: number;
  };
  unmatchedCompletedCount: number;

  tasks: TaskAnalysisItem[];
}

export function computeTaskAnalysis(
  examTasks: RawExamTask[] = [],
  submissions: RawSubmission[] = []
): ExamTaskAnalysis {
  const totalSubmissions = submissions.length;
  const completedSubmissions = submissions.filter((s) => s.status === 'COMPLETED');
  const completedSubmissionsCount = completedSubmissions.length;
  const excludedSubmissionsCount = totalSubmissions - completedSubmissionsCount;

  const excludedBreakdown = {
    pending: submissions.filter((s) => s.status === 'PENDING').length,
    processing: submissions.filter((s) => s.status === 'PROCESSING').length,
    failed: submissions.filter((s) => s.status === 'FAILED').length,
  };

  const unmatchedCompletedCount = completedSubmissions.filter((s) => !s.studentId).length;

  // Kanonische Aufgaben ermitteln: entweder aus examTasks oder aus den Submissions ableiten
  let canonicalTasks: RawExamTask[] = [];
  if (examTasks && examTasks.length > 0) {
    canonicalTasks = [...examTasks].sort((a, b) => a.orderIndex - b.orderIndex);
  } else {
    const taskMap = new Map<string, RawExamTask>();
    for (const sub of completedSubmissions) {
      if (sub.tasks) {
        for (const tc of sub.tasks) {
          const key = tc.taskId || tc.title;
          if (!taskMap.has(key)) {
            taskMap.set(key, {
              taskId: tc.taskId || `task-${taskMap.size + 1}`,
              title: tc.title || `Aufgabe ${taskMap.size + 1}`,
              maxPoints: tc.maximalPunkte || 0,
              orderIndex: tc.orderIndex ?? taskMap.size,
            });
          }
        }
      }
    }
    canonicalTasks = Array.from(taskMap.values()).sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const tasksAnalysis: TaskAnalysisItem[] = canonicalTasks.map((canonicalTask) => {
    const matchingCorrections: RawTaskCorrection[] = [];
    let gradedCount = 0;

    for (const sub of completedSubmissions) {
      const tc = sub.tasks?.find(
        (t) =>
          t.taskId === canonicalTask.taskId ||
          t.taskId === canonicalTask.id ||
          (t.orderIndex === canonicalTask.orderIndex && t.title === canonicalTask.title) ||
          t.title.trim().toLowerCase() === canonicalTask.title.trim().toLowerCase()
      );

      if (tc) {
        matchingCorrections.push(tc);
        gradedCount++;
      }
    }

    const ungradedCount = completedSubmissionsCount - gradedCount;

    let korrekt = 0;
    let folgefehler = 0;
    let fehler = 0;
    let hasMaxPointsDeviation = false;
    let totalAchievedPoints = 0;

    for (const tc of matchingCorrections) {
      if (tc.status === 'Korrekt') korrekt++;
      else if (tc.status === 'Folgefehler') folgefehler++;
      else if (tc.status === 'Fehler') fehler++;

      if (Number(tc.maximalPunkte) !== Number(canonicalTask.maxPoints)) {
        hasMaxPointsDeviation = true;
      }

      totalAchievedPoints += Number(tc.erzieltePunkte) || 0;
    }

    const isZeroMaxPoints = canonicalTask.maxPoints === 0;

    let avgPoints: number | null = null;
    let avgPercent: number | null = null;

    if (gradedCount > 0) {
      avgPoints = Math.round((totalAchievedPoints / gradedCount) * 100) / 100;
      if (!isZeroMaxPoints && canonicalTask.maxPoints > 0) {
        avgPercent = Math.round((avgPoints / canonicalTask.maxPoints) * 1000) / 10;
      }
    }

    // Teilschritt-Analyse
    let hasVaryingStepStructure = false;
    let totalUncertainSteps = 0;

    const subsWithSteps = matchingCorrections.filter(
      (tc) => Array.isArray(tc.schritte) && tc.schritte.length > 0
    );

    if (subsWithSteps.length > 1) {
      const firstIndices = subsWithSteps[0]
        .schritte!.map((s) => s.schrittIndex)
        .sort((a, b) => a - b)
        .join(',');

      for (let i = 1; i < subsWithSteps.length; i++) {
        const currentIndices = subsWithSteps[i]
          .schritte!.map((s) => s.schrittIndex)
          .sort((a, b) => a - b)
          .join(',');
        if (currentIndices !== firstIndices) {
          hasVaryingStepStructure = true;
          break;
        }
      }
    }

    const stepMap = new Map<number, RawStepCorrection[]>();
    for (const tc of matchingCorrections) {
      if (Array.isArray(tc.schritte)) {
        for (const step of tc.schritte) {
          if (step.istUnsicher) {
            totalUncertainSteps++;
          }
          const list = stepMap.get(step.schrittIndex) || [];
          list.push(step);
          stepMap.set(step.schrittIndex, list);
        }
      }
    }

    const sortedStepIndices = Array.from(stepMap.keys()).sort((a, b) => a - b);
    const stepAnalyses: StepAnalysis[] = sortedStepIndices.map((idx) => {
      const stepsForIndex = stepMap.get(idx)!;
      let stepKeinFehler = 0;
      let stepRechenfehler = 0;
      let stepFolgefehler = 0;
      let stepSonstigerFehler = 0;
      let stepTotalAchieved = 0;
      let stepTotalMax = 0;
      let stepUncertain = 0;
      let stepText = '';

      for (const st of stepsForIndex) {
        if (!stepText && st.schrittText) {
          stepText = st.schrittText;
        }
        if (st.fehlerTyp === 'KeinFehler') stepKeinFehler++;
        else if (st.fehlerTyp === 'Rechenfehler') stepRechenfehler++;
        else if (st.fehlerTyp === 'Folgefehler') stepFolgefehler++;
        else if (st.fehlerTyp === 'SonstigerFehler') stepSonstigerFehler++;

        stepTotalAchieved += Number(st.erreichtePunkte) || 0;
        stepTotalMax += Number(st.maximalPunkte) || 0;
        if (st.istUnsicher) stepUncertain++;
      }

      const count = stepsForIndex.length;
      return {
        schrittIndex: idx,
        schrittText: stepText || `Schritt ${idx + 1}`,
        count,
        errorCounts: {
          KeinFehler: stepKeinFehler,
          Rechenfehler: stepRechenfehler,
          Folgefehler: stepFolgefehler,
          SonstigerFehler: stepSonstigerFehler,
        },
        avgErreichtePunkte: count > 0 ? Math.round((stepTotalAchieved / count) * 100) / 100 : 0,
        avgMaximalPunkte: count > 0 ? Math.round((stepTotalMax / count) * 100) / 100 : 0,
        uncertainCount: stepUncertain,
      };
    });

    return {
      id: canonicalTask.id || canonicalTask.taskId,
      taskId: canonicalTask.taskId,
      title: canonicalTask.title,
      orderIndex: canonicalTask.orderIndex,
      canonicalMaxPoints: canonicalTask.maxPoints,
      gradedCount,
      ungradedCount,
      avgPoints,
      avgPercent,
      statusDistribution: {
        korrekt,
        folgefehler,
        fehler,
      },
      hasMaxPointsDeviation,
      isZeroMaxPoints,
      hasSteps: stepAnalyses.length > 0,
      hasVaryingStepStructure,
      uncertainStepsCount: totalUncertainSteps,
      steps: stepAnalyses,
    };
  });

  return {
    totalSubmissions,
    completedSubmissionsCount,
    excludedSubmissionsCount,
    excludedBreakdown,
    unmatchedCompletedCount,
    tasks: tasksAnalysis,
  };
}
