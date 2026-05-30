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

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const formData = await request.formData();
    const studentId = formData.get('studentId') as string | null; // Can be null for AI Auto-matching
    const classId = formData.get('classId') as string | null;
    const examId = formData.get('examId') as string | null; // For existing exams
    const overwrite = formData.get('overwrite') === 'true';

    // For new exams
    const examTitle = formData.get('examTitle') as string | null;
    const examSubject = formData.get('examSubject') as string | null;
    const rubric = formData.get('rubric') as File | string | null;

    // Core parameters
    const studentExam = formData.get('studentExam') as File | null;
    const model = (formData.get('model') as string) || 'gemini-3.5-flash';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Gemini API-Schlüssel fehlt. Bitte trage deinen API-Schlüssel in der .env.local Datei ein.',
        },
        { status: 401 }
      );
    }

    if (!classId) {
      return NextResponse.json({ error: 'Klasse muss ausgewählt sein.' }, { status: 400 });
    }

    if (!studentExam) {
      return NextResponse.json(
        { error: 'Es wurde keine Schülerarbeit hochgeladen.' },
        { status: 400 }
      );
    }

    // Pre-flight check: If studentId and examId are selected
    if (examId && studentId) {
      const existingSubmission = await db.submission.findUnique({
        where: {
          examId_studentId: {
            examId,
            studentId,
          },
        },
      });

      if (existingSubmission && !overwrite) {
        return NextResponse.json(
          {
            error: 'Für diesen Schüler existiert bereits eine Korrektur für diese Prüfung.',
            exists: true,
          },
          { status: 409 }
        );
      }
    }

    // 2. Fetch/resolve the rubric data from DB or parameters
    let rubricParam: string | { mimeType: string; data: string } = '';
    let rubricTextString = '';

    let finalExamId = examId;

    if (examId) {
      // Fetch existing exam details
      const existingExam = await db.exam.findUnique({
        where: { id: examId },
      });
      if (!existingExam) {
        return NextResponse.json(
          { error: 'Ausgewählte Prüfung existiert nicht.' },
          { status: 404 }
        );
      }
      if (existingExam.rubricText.startsWith('{"mimeType":')) {
        try {
          const parsed = JSON.parse(existingExam.rubricText);
          rubricParam = parsed;
          const isPdf = typeof parsed !== 'string' && parsed.mimeType === 'application/pdf';
          rubricTextString = isPdf
            ? 'Musterlösung als PDF hinterlegt'
            : 'Musterlösung als Bild hinterlegt';
        } catch {
          rubricParam = existingExam.rubricText;
          rubricTextString = existingExam.rubricText;
        }
      } else {
        rubricParam = existingExam.rubricText;
        rubricTextString = existingExam.rubricText;
      }
    } else {
      // Process uploaded new rubric or find existing one dynamically to avoid double creations in batch
      if (!examTitle || !examSubject || !rubric) {
        return NextResponse.json(
          {
            error:
              'Prüfungstitel, Fach und Musterlösung müssen für eine neue Prüfung angegeben werden.',
          },
          { status: 400 }
        );
      }

      if (typeof rubric === 'string') {
        rubricParam = rubric;
        rubricTextString = rubric;
      } else {
        const mimeType = rubric.type || '';
        const rubricBytes = await rubric.arrayBuffer();

        if (mimeType.startsWith('image/') || mimeType === 'application/pdf') {
          const base64Data = Buffer.from(rubricBytes).toString('base64');
          rubricParam = { mimeType, data: base64Data };
          rubricTextString = JSON.stringify(rubricParam);
        } else {
          rubricTextString = Buffer.from(rubricBytes).toString('utf-8');
          rubricParam = rubricTextString;
        }
      }

      // Check if an exam with this title already exists in this class (for bulk uploader concurrency)
      const existingExam = await db.exam.findFirst({
        where: { title: examTitle, classId },
      });

      if (existingExam) {
        finalExamId = existingExam.id;
      } else {
        const examRecord = await db.exam.create({
          data: {
            title: examTitle,
            subject: examSubject,
            rubricText: rubricTextString,
            maxPoints: 0, // Will be updated by the first finished correction
            classId: classId,
          },
        });
        finalExamId = examRecord.id;
      }
    }

    if (!finalExamId) {
      return NextResponse.json({ error: 'Prüfungszuordnung fehlgeschlagen.' }, { status: 500 });
    }

    // 3. Process student exam to base64 for Gemini
    const studentBytes = await studentExam.arrayBuffer();
    const studentBase64 = Buffer.from(studentBytes).toString('base64');

    // 4. Save the exam sheet document to the local filesystem (Option A)
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const submissionId = crypto.randomUUID();
    const fileExtension = studentExam.name.split('.').pop() || 'jpg';
    const fileName = `${submissionId}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, Buffer.from(studentBytes));
    const savedFilePath = `/uploads/${fileName}`;

    // Fetch names synchronously for decouple logging
    const [classRecord, examRecordSync] = await Promise.all([
      db.class.findUnique({ where: { id: classId } }),
      db.exam.findUnique({ where: { id: finalExamId } }),
    ]);

    const resolvedClassName = classRecord?.name || 'Unbekannte Klasse';
    const resolvedExamTitle = examRecordSync?.title || 'Unbekannte Prüfung';

    let resolvedStudentName = 'Automatische Zuordnung';
    if (studentId) {
      const studentRecord = await db.student.findUnique({ where: { id: studentId } });
      if (studentRecord) {
        resolvedStudentName = studentRecord.name;
      }
    }

    // 5. Create PENDING placeholder Submission record in the DB
    const submission = await db.submission.create({
      data: {
        id: submissionId,
        examId: finalExamId,
        studentId: null, // Always null initially to avoid unique constraint violations
        targetStudentId: studentId || null, // Track targeted student if provided
        status: 'PENDING',
        earnedPoints: 0.0,
        gradeRaw: 1.0,
        gradeRounded: '1.0',
        strengths: [],
        weaknesses: [],
        helpfulTip: null,
        exerciseRecommendation: null,
        studentExamUrl: savedFilePath,
      },
    });

    // Create decoupling CorrectionLog record synchronously
    const logRecord = await db.correctionLog.create({
      data: {
        submissionId: submissionId,
        teacherId: session.userId,
        className: resolvedClassName,
        examTitle: resolvedExamTitle,
        studentName: resolvedStudentName,
        modelUsed: model,
        status: 'PENDING',
        actionType: overwrite ? 'ERSETZT' : 'ERSTELLT',
      },
    });

    // 6. Schedule heavy live Gemini OCR and correction in the background using stable Next.js after()
    after(async () => {
      const startTime = Date.now();
      let finalStudentName = resolvedStudentName;

      try {
        // 1. Update status to PROCESSING
        await db.submission.update({
          where: { id: submissionId },
          data: { status: 'PROCESSING' },
        });

        await db.correctionLog.update({
          where: { id: logRecord.id },
          data: { status: 'PROCESSING' },
        });

        // 2. Fetch the predefined tasks of this exam if available
        const examRecord = await db.exam.findUnique({
          where: { id: finalExamId },
          include: { tasks: true },
        });

        const predefinedTasks =
          examRecord?.tasks && examRecord.tasks.length > 0
            ? examRecord.tasks.map((t) => ({
                taskId: t.taskId,
                title: t.title,
                maxPoints: t.maxPoints,
              }))
            : undefined;

        // 3. Run live Gemini OCR and correction analysis
        const result = await runLiveGeminiCorrection(
          studentBase64,
          rubricParam,
          model as 'gemini-3.5-flash' | 'gemini-3.1-pro-preview',
          apiKey,
          studentExam.type || 'image/jpeg',
          predefinedTasks
        );

        // 4. Perform AI Auto-Matching if studentId was not provided synchronously
        let matchedStudentId = studentId || null;
        if (!matchedStudentId && result.schuelerName) {
          const classStudents = await db.student.findMany({
            where: { classId },
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

        // 5. Update Exam maxPoints based on the resolved points of the first finished grading
        // ONLY if the exam has NO predefined tasks yet!
        const hasPredefinedTasks = examRecord && examRecord.tasks && examRecord.tasks.length > 0;
        if (
          examRecord &&
          !hasPredefinedTasks &&
          (examRecord.maxPoints === 0 || examRecord.maxPoints !== result.gesamtmaximalPunkte)
        ) {
          await db.exam.update({
            where: { id: finalExamId },
            data: { maxPoints: result.gesamtmaximalPunkte },
          });
        }

        // 6. Execute transaction to write AI grading results
        await db.$transaction(async (tx) => {
          // Check for duplicate submissions and delete inside the transaction if overwrite is enabled
          if (matchedStudentId) {
            const existingSubmission = await tx.submission.findFirst({
              where: {
                examId: finalExamId,
                studentId: matchedStudentId,
                id: { not: submissionId }, // Exclude current record
              },
            });

            if (existingSubmission) {
              if (overwrite) {
                // Delete existing completed submission to overwrite it in the same transaction
                await tx.submission.delete({
                  where: { id: existingSubmission.id },
                });
              } else {
                throw new Error(
                  `Für Schüler/in "${result.schuelerName}" existiert bereits eine Korrektur. Klicke auf 'Korrektur ersetzen', um sie zu überschreiben.`
                );
              }
            }
          }

          await tx.submission.update({
            where: { id: submissionId },
            data: {
              studentId: matchedStudentId, // Can be null if unmatched (unassigned)
              targetStudentId: null, // Clear the temporary target field on completion
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

          // Batch Task and Step corrections
          const taskCorrectionsData = [];
          const stepCorrectionsData = [];

          for (let tIdx = 0; tIdx < result.aufgaben.length; tIdx++) {
            const task = result.aufgaben[tIdx];

            let taskStatus: 'Korrekt' | 'Folgefehler' | 'Fehler' = 'Korrekt';
            if (task.status === 'Folgefehler') taskStatus = 'Folgefehler';
            else if (task.status === 'Fehler') taskStatus = 'Fehler';

            const taskCorrectionId = crypto.randomUUID();

            let calculatedTaskPoints = 0;
            const hasSteps = Array.isArray(task.schritte) && task.schritte.length > 0;

            // Insert Teilschritte
            if (hasSteps) {
              for (const step of task.schritte) {
                let errorType: 'KeinFehler' | 'Rechenfehler' | 'Folgefehler' | 'SonstigerFehler' =
                  'KeinFehler';
                if (step.fehlerTyp === 'Rechenfehler') errorType = 'Rechenfehler';
                else if (step.fehlerTyp === 'Folgefehler') errorType = 'Folgefehler';
                else if (step.fehlerTyp === 'SonstigerFehler') errorType = 'SonstigerFehler';

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
                  fehlerTyp: errorType,
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
              status: taskStatus,
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

        // 7. Update decouple CorrectionLog to COMPLETED
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
            `Background grading for submission ${submissionId} was cancelled by the user (record deleted).`
          );

          // Update decoupled CorrectionLog to CANCELLED
          try {
            await db.correctionLog.update({
              where: { id: logRecord.id },
              data: {
                status: 'CANCELLED',
                durationMs,
              },
            });
          } catch (logErr) {
            console.error('Failed to set CANCELLED state on CorrectionLog:', logErr);
          }
          return;
        }

        console.error(`Background grading error for submission ${submissionId}:`, error);
        const errMsg = error instanceof Error ? error.message : String(error);

        // Update decoupled CorrectionLog to FAILED
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
          console.error('Failed to set FAILED state on CorrectionLog:', logErr);
        }

        // Mark as FAILED in DB and store error details
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
            console.error(`Failed to set FAILED state on submission ${submissionId}:`, dbErr);
          } else {
            console.log(
              `Failed to set FAILED state: submission ${submissionId} was already deleted (cancelled).`
            );
          }
        }
      }
    });

    // 7. Instantly return PENDING submission details to the client
    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      examId: finalExamId,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Error in API /correct route (sync part):', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Upload fehlgeschlagen: ' + errMessage }, { status: 500 });
  }
}
