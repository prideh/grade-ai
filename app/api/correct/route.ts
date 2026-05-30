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

    // Pre-flight check: If studentId and examId are selected and overwrite is false
    if (examId && studentId && !overwrite) {
      const existingSubmission = await db.submission.findUnique({
        where: {
          examId_studentId: {
            examId,
            studentId,
          },
        },
      });

      if (existingSubmission) {
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
          rubricParam = JSON.parse(existingExam.rubricText);
          rubricTextString = 'Musterlösung als Bild hinterlegt';
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

        if (mimeType.startsWith('image/')) {
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

    // 5. Create PENDING placeholder Submission record in the DB
    const submission = await db.submission.create({
      data: {
        id: submissionId,
        examId: finalExamId,
        studentId: studentId || null, // Optional. Matched in background if null.
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

    // 6. Schedule heavy live Gemini OCR and correction in the background using stable Next.js after()
    after(async () => {
      try {
        // 1. Update status to PROCESSING
        await db.submission.update({
          where: { id: submissionId },
          data: { status: 'PROCESSING' },
        });

        // 2. Run live Gemini OCR and correction analysis
        const result = await runLiveGeminiCorrection(
          studentBase64,
          rubricParam,
          model as 'gemini-3.5-flash' | 'gemini-3.1-pro',
          apiKey
        );

        // 3. Perform AI Auto-Matching if studentId was not provided synchronously
        let matchedStudentId = studentId || null;
        if (!matchedStudentId && result.schuelerName) {
          const classStudents = await db.student.findMany({
            where: { classId },
          });
          matchedStudentId = matchStudentByName(result.schuelerName, classStudents);
        }

        // 4. Check for duplicate submissions before committing (if student was resolved)
        if (matchedStudentId) {
          const existingSubmission = await db.submission.findFirst({
            where: {
              examId: finalExamId,
              studentId: matchedStudentId,
              id: { not: submissionId }, // Exclude current record
            },
          });

          if (existingSubmission) {
            if (overwrite) {
              // Delete existing submission to overwrite
              await db.submission.delete({
                where: { id: existingSubmission.id },
              });
            } else {
              throw new Error(
                `Für Schüler/in "${result.schuelerName}" existiert bereits eine Korrektur. Aktiviere 'Überschreiben', um sie zu ersetzen.`
              );
            }
          }
        }

        // 5. Update Exam maxPoints based on the resolved points of the first finished grading
        const examRecord = await db.exam.findUnique({ where: { id: finalExamId } });
        if (
          examRecord &&
          (examRecord.maxPoints === 0 || examRecord.maxPoints !== result.gesamtmaximalPunkte)
        ) {
          await db.exam.update({
            where: { id: finalExamId },
            data: { maxPoints: result.gesamtmaximalPunkte },
          });
        }

        // 6. Execute transaction to write AI grading results
        await db.$transaction(async (tx) => {
          await tx.submission.update({
            where: { id: submissionId },
            data: {
              studentId: matchedStudentId, // Can be null if unmatched (unassigned)
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

            taskCorrectionsData.push({
              id: taskCorrectionId,
              submissionId: submissionId,
              taskId: task.aufgabeId,
              title: task.titel,
              studentAnswer: task.schuelerAntwort,
              erzieltePunkte: task.erzieltePunkte,
              maximalPunkte: task.maximalPunkte,
              status: taskStatus,
              lehrerKommentar: task.lehrerKommentar || '',
              orderIndex: tIdx,
            });

            // Insert Teilschritte
            for (const step of task.schritte) {
              let errorType: 'KeinFehler' | 'Rechenfehler' | 'Folgefehler' | 'SonstigerFehler' =
                'KeinFehler';
              if (step.fehlerTyp === 'Rechenfehler') errorType = 'Rechenfehler';
              else if (step.fehlerTyp === 'Folgefehler') errorType = 'Folgefehler';
              else if (step.fehlerTyp === 'SonstigerFehler') errorType = 'SonstigerFehler';

              stepCorrectionsData.push({
                id: crypto.randomUUID(),
                taskCorrectionId: taskCorrectionId,
                schrittIndex: step.schrittIndex,
                schrittText: step.schrittText,
                istKorrekt: step.istKorrekt,
                fehlerTyp: errorType,
                erreichtePunkte: step.erreichtePunkte,
                maximalPunkte: step.maximalPunkte,
                begruendung: step.begruendung || '',
              });
            }
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
      } catch (error) {
        console.error(`Background grading error for submission ${submissionId}:`, error);
        const errMsg = error instanceof Error ? error.message : String(error);

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
          console.error(`Failed to set FAILED state on submission ${submissionId}:`, dbErr);
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
