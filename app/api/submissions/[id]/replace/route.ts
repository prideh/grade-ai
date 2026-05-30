import { NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { runLiveGeminiCorrection } from '@/lib/gemini';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Helper to fuzzy match student names against class student database
function matchStudentByName(
  extractedName: string,
  students: { id: string; name: string }[]
): string | null {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  const cleanExtracted = clean(extractedName);
  if (!cleanExtracted) return null;

  // 1. Exact match after cleaning
  let matches = students.filter((s) => clean(s.name) === cleanExtracted);
  if (matches.length === 1) return matches[0].id;

  // 2. Part match: database name contains extracted name, or vice versa
  matches = students.filter((s) => {
    const cleanDb = clean(s.name);
    return cleanDb.includes(cleanExtracted) || cleanExtracted.includes(cleanDb);
  });
  if (matches.length === 1) return matches[0].id;

  // 3. Token-based matching (e.g. "Max Mustermann" matches "Max" or "Mustermann" if unique)
  const extractedTokens = cleanExtracted.split(/\s+/).filter(Boolean);
  matches = students.filter((s) => {
    const dbTokens = clean(s.name).split(/\s+/).filter(Boolean);
    return (
      dbTokens.some((t) => extractedTokens.includes(t)) ||
      extractedTokens.some((t) => dbTokens.includes(t))
    );
  });
  if (matches.length === 1) return matches[0].id;

  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: submissionId } = await params;

    // 2. Fetch the failed submission
    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      include: {
        exam: {
          include: {
            class: true,
          },
        },
      },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Korrektur nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns the class
    if (submission.exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    if (!submission.studentExamUrl) {
      return NextResponse.json(
        { error: 'Dokumenten-Scan der Arbeit wurde nicht gefunden.' },
        { status: 400 }
      );
    }

    let resolvedStudentName = 'Automatische Zuordnung';
    if (submission.studentId) {
      const student = await db.student.findUnique({
        where: { id: submission.studentId },
      });
      if (student) {
        resolvedStudentName = student.name;
      }
    }

    // Reset status to PROCESSING to display active loading spinner
    await db.submission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSING', errorMessage: null },
    });

    // Create decoupling CorrectionLog record synchronously
    const logRecord = await db.correctionLog.create({
      data: {
        submissionId: submissionId,
        teacherId: session.userId,
        className: submission.exam.class.name,
        examTitle: submission.exam.title,
        studentName: resolvedStudentName,
        modelUsed: 'gemini-3.5-flash',
        status: 'PROCESSING', // Starts directly in PROCESSING
        actionType: 'ERSETZT',
      },
    });

    // 3. Schedule the background task using Next.js after() to re-run correction with overwrite = true
    after(async () => {
      const startTime = Date.now();
      let finalStudentName = resolvedStudentName;

      try {
        // Read file from disk and convert to base64
        const filePath = path.join(process.cwd(), 'public', submission.studentExamUrl!);
        const studentBytes = await fs.readFile(filePath);
        const studentBase64 = studentBytes.toString('base64');
        const fileExtension = submission.studentExamUrl!.split('.').pop() || 'jpg';
        const mimeType = fileExtension === 'pdf' ? 'application/pdf' : 'image/jpeg';

        // Load rubric context
        let rubricParam: string | { mimeType: string; data: string } = '';
        if (submission.exam.rubricText.startsWith('{"mimeType":')) {
          try {
            rubricParam = JSON.parse(submission.exam.rubricText);
          } catch {
            rubricParam = submission.exam.rubricText;
          }
        } else {
          rubricParam = submission.exam.rubricText;
        }

        // Fetch predefined tasks if available
        const examTasks = await db.examTask.findMany({
          where: { examId: submission.examId },
          orderBy: { orderIndex: 'asc' },
        });

        const predefinedTasks =
          examTasks.length > 0
            ? examTasks.map((t) => ({
                taskId: t.taskId,
                title: t.title,
                maxPoints: t.maxPoints,
              }))
            : undefined;

        // Run live Gemini OCR and correction analysis
        const result = await runLiveGeminiCorrection(
          studentBase64,
          rubricParam,
          'gemini-3.5-flash',
          process.env.GEMINI_API_KEY,
          mimeType,
          predefinedTasks
        );

        // Resolve student ID via auto-matching if student was not manually set previously
        let matchedStudentId = submission.studentId;
        if (!matchedStudentId && result.schuelerName) {
          const classStudents = await db.student.findMany({
            where: { classId: submission.exam.classId },
          });
          matchedStudentId = matchStudentByName(result.schuelerName, classStudents);
          if (matchedStudentId) {
            const matchedRec = classStudents.find((s) => s.id === matchedStudentId);
            if (matchedRec) {
              finalStudentName = matchedRec.name;
            }
          } else {
            finalStudentName = `${result.schuelerName} (Nicht zugeordnet)`;
          }
        }

        if (!matchedStudentId) {
          throw new Error(
            'Der Schülername auf dem Scan konnte keinem Schüler in der Klasse eindeutig zugeordnet werden.'
          );
        }

        // Execute transaction to delete duplicate submission and save the new correction
        await db.$transaction(async (tx) => {
          // Delete existing completed/duplicate submission for the matched student to overwrite it
          const existingSubmission = await tx.submission.findFirst({
            where: {
              examId: submission.examId,
              studentId: matchedStudentId,
              id: { not: submissionId }, // Exclude current record
            },
          });

          if (existingSubmission) {
            await tx.submission.delete({
              where: { id: existingSubmission.id },
            });
          }

          // Delete any legacy task corrections that were partially generated
          await tx.taskCorrection.deleteMany({
            where: { submissionId },
          });

          // Update current submission with new completed correction results
          await tx.submission.update({
            where: { id: submissionId },
            data: {
              studentId: matchedStudentId,
              status: 'COMPLETED',
              earnedPoints: result.gesamterzieltePunkte,
              gradeRaw: parseFloat(result.note),
              gradeRounded: result.note,
              strengths: result.schuelerFeedback.staerken,
              weaknesses: result.schuelerFeedback.schwaechen,
              helpfulTip: result.schuelerFeedback.hilfreicherTipp,
              exerciseRecommendation: result.schuelerFeedback.uebungsEmpfehlung,
            },
          });

          // Insert Task and Step corrections
          const taskCorrectionsData = [];
          const stepCorrectionsData = [];

          for (let tIdx = 0; tIdx < result.aufgaben.length; tIdx++) {
            const task = result.aufgaben[tIdx];
            const taskCorrectionId = crypto.randomUUID();

            let calculatedTaskPoints = 0;
            const hasSteps = Array.isArray(task.schritte) && task.schritte.length > 0;

            if (hasSteps) {
              for (const step of task.schritte) {
                const clampedStepMax = Math.max(0, Number(step.maximalPunkte || 0));
                const clampedStepEarned = Math.max(
                  0,
                  Math.min(clampedStepMax, Number(step.erreichtePunkte || 0))
                );

                calculatedTaskPoints += clampedStepEarned;

                stepCorrectionsData.push({
                  id: crypto.randomUUID(),
                  taskCorrectionId: taskCorrectionId,
                  schrittIndex: step.schrittIndex,
                  schrittText: step.schrittText,
                  istKorrekt: step.istKorrekt,
                  fehlerTyp: step.fehlerTyp as
                    | 'KeinFehler'
                    | 'Rechenfehler'
                    | 'Folgefehler'
                    | 'SonstigerFehler',
                  erreichtePunkte: clampedStepEarned,
                  maximalPunkte: clampedStepMax,
                  begruendung: step.begruendung || '',
                });
              }
            }

            const clampedTaskMax = Math.max(0, Number(task.maximalPunkte || 0));
            const finalTaskPoints = hasSteps
              ? Math.round(calculatedTaskPoints * 10) / 10
              : Math.max(0, Math.min(clampedTaskMax, Number(task.erzieltePunkte || 0)));

            taskCorrectionsData.push({
              id: taskCorrectionId,
              submissionId: submissionId,
              taskId: task.aufgabeId,
              title: task.titel,
              studentAnswer: task.schuelerAntwort,
              erzieltePunkte: finalTaskPoints,
              maximalPunkte: clampedTaskMax,
              status: task.status as 'Korrekt' | 'Folgefehler' | 'Fehler',
              lehrerKommentar: task.lehrerKommentar || '',
              orderIndex: tIdx,
            });
          }

          if (taskCorrectionsData.length > 0) {
            await tx.taskCorrection.createMany({
              data: taskCorrectionsData,
            });
          }

          if (stepCorrectionsData.length > 0) {
            await tx.stepCorrection.createMany({
              data: stepCorrectionsData,
            });
          }
        });

        // Update decouple CorrectionLog to COMPLETED
        const durationMs = Date.now() - startTime;
        await db.correctionLog.update({
          where: { id: logRecord.id },
          data: {
            status: 'COMPLETED',
            studentName: finalStudentName,
            durationMs,
          },
        });
      } catch (error) {
        const durationMs = Date.now() - startTime;

        // Check if this error is due to the submission being deleted (e.g. cancelled by the user)
        const isCancelled =
          error && typeof error === 'object' && 'code' in error && error.code === 'P2025';

        if (isCancelled) {
          console.log(
            `Background replace for submission ${submissionId} was cancelled by the user (record deleted).`
          );

          // Update decouple CorrectionLog to CANCELLED
          try {
            await db.correctionLog.update({
              where: { id: logRecord.id },
              data: {
                status: 'CANCELLED',
                durationMs,
              },
            });
          } catch (logErr) {
            console.error('Failed to set CANCELLED status on CorrectionLog:', logErr);
          }
          return;
        }

        console.error(`Background replace error for submission ${submissionId}:`, error);
        const errMsg = error instanceof Error ? error.message : String(error);

        // Update decouple CorrectionLog to FAILED
        try {
          await db.correctionLog.update({
            where: { id: logRecord.id },
            data: {
              status: 'FAILED',
              studentName: finalStudentName,
              durationMs,
              errorMessage: errMsg,
            },
          });
        } catch (logErr) {
          console.error('Failed to set FAILED status on CorrectionLog:', logErr);
        }

        try {
          await db.submission.update({
            where: { id: submissionId },
            data: {
              status: 'FAILED',
              errorMessage: errMsg,
            },
          });
        } catch (dbErr) {
          const isDbErrCancelled =
            dbErr && typeof dbErr === 'object' && 'code' in dbErr && dbErr.code === 'P2025';

          if (!isDbErrCancelled) {
            console.error(`Failed to set FAILED status on submission ${submissionId}:`, dbErr);
          } else {
            console.log(
              `Failed to set FAILED status: submission ${submissionId} was already deleted (cancelled).`
            );
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in replace API endpoint:', error);
    return NextResponse.json(
      { error: 'Die Korrektur konnte nicht neu gestartet werden.' },
      { status: 500 }
    );
  }
}
