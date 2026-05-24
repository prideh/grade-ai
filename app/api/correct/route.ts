import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { runLiveGeminiCorrection } from '@/lib/gemini';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const formData = await request.formData();
    const studentId = formData.get('studentId') as string | null;
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

    if (!studentId || !classId) {
      return NextResponse.json(
        { error: 'Student und Klasse müssen ausgewählt sein.' },
        { status: 400 }
      );
    }

    if (!studentExam) {
      return NextResponse.json(
        { error: 'Es wurde keine Schülerarbeit hochgeladen.' },
        { status: 400 }
      );
    }

    // Pre-flight check: If the correction already exists, do not call Gemini unless forced (overwrite=true)
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

    if (examId) {
      // Fetch existing exam details
      const existingExam = await db.exam.findUnique({
        where: { id: examId },
      });
      if (!existingExam) {
        return NextResponse.json({ error: 'Ausgewählte Prüfung existiert nicht.' }, { status: 404 });
      }
      rubricParam = existingExam.rubricText;
      rubricTextString = existingExam.rubricText;
    } else {
      // Process uploaded new rubric
      if (!examTitle || !examSubject || !rubric) {
        return NextResponse.json(
          { error: 'Prüfungstitel, Fach und Musterlösung müssen für eine neue Prüfung angegeben werden.' },
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
          rubricTextString = 'Musterlösung als Bild hochgeladen';
        } else {
          rubricTextString = Buffer.from(rubricBytes).toString('utf-8');
          rubricParam = rubricTextString;
        }
      }
    }

    // 3. Process student exam to base64 for Gemini
    const studentBytes = await studentExam.arrayBuffer();
    const studentBase64 = Buffer.from(studentBytes).toString('base64');

    // 4. Run live Gemini OCR and correction analysis
    const result = await runLiveGeminiCorrection(
      studentBase64,
      rubricParam,
      model as 'gemini-3.5-flash' | 'gemini-3.1-pro',
      apiKey
    );

    // 5. Save the exam sheet document to the local filesystem (Option A)
    // NOTE FOR PRODUCTION DEPLOYMENTS:
    // currently we are using Option A (local filesystem upload under public/uploads/).
    // TODO: Migrate this local storage logic to an S3-compatible cloud storage solution 
    // (e.g. AWS S3, Supabase Storage, or Vercel Blob) when deploying to production.
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    const submissionId = crypto.randomUUID();
    const fileExtension = studentExam.name.split('.').pop() || 'jpg';
    const fileName = `${submissionId}.${fileExtension}`;
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, Buffer.from(studentBytes));
    const savedFilePath = `/uploads/${fileName}`;

    // 6. Execute a transactional write to commit all tables atomically
    const submission = await db.$transaction(async (tx) => {
      // If overwrite is true, delete existing submission (cleans cascading tasks & steps)
      if (examId && studentId && overwrite) {
        await tx.submission.deleteMany({
          where: {
            examId: examId,
            studentId: studentId,
          },
        });
      }

      // Ensure the student exists and matches
      const studentRecord = await tx.student.findUnique({
        where: { id: studentId },
      });
      if (!studentRecord) {
        throw new Error('Schüler nicht gefunden.');
      }

      // Find or create the Exam record
      let finalExamId = examId;
      if (!finalExamId) {
        const examRecord = await tx.exam.create({
          data: {
            title: examTitle!,
            subject: examSubject!,
            rubricText: rubricTextString,
            maxPoints: result.gesamtmaximalPunkte,
            classId: classId,
          },
        });
        finalExamId = examRecord.id;
      } else {
        // If the exam already exists, update its maxPoints to match the total rubric points resolved by Gemini.
        // This prevents mismatch issues if the teacher enters a wrong maxPoints manually in the creation form.
        await tx.exam.update({
          where: { id: finalExamId },
          data: { maxPoints: result.gesamtmaximalPunkte },
        });
      }

      // Create the Submission record
      const submissionRecord = await tx.submission.create({
        data: {
          id: submissionId,
          examId: finalExamId,
          studentId: studentId,
          status: 'COMPLETED',
          earnedPoints: result.gesamterzieltePunkte,
          gradeRaw: parseFloat(result.note),
          gradeRounded: result.note,
          strengths: result.schuelerFeedback.staerken,
          weaknesses: result.schuelerFeedback.schwaechen,
          helpfulTip: result.schuelerFeedback.hilfreicherTipp,
          exerciseRecommendation: result.schuelerFeedback.uebungsEmpfehlung,
          studentExamUrl: savedFilePath,
        },
      });

      // Batch Task and Step corrections in memory and insert using createMany
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
          submissionId: submissionRecord.id,
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
          let errorType: 'KeinFehler' | 'Rechenfehler' | 'Folgefehler' | 'SonstigerFehler' = 'KeinFehler';
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

      return submissionRecord;
    });

    // Return the created database submission ID
    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      schuelerName: result.schuelerName,
    });
  } catch (error) {
    console.error('Error in API /correct route:', error);
    const errMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Korrektur fehlgeschlagen: ' + errMessage }, { status: 500 });
  }
}
