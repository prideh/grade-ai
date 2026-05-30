import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET: Fetch a submission by ID and map to standard ExamCorrectionResult
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: submissionId } = await params;

    const submission = await db.submission.findUnique({
      where: { id: submissionId },
      include: {
        student: true,
        exam: {
          include: {
            class: true,
          },
        },
        tasks: {
          include: {
            schritte: true,
          },
          orderBy: {
            orderIndex: 'asc',
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

    // Map DB relational model to ExamCorrectionResult frontend format
    const responseData = {
      id: submission.id,
      status: submission.status,
      errorMessage: submission.errorMessage,
      schuelerName: submission.student?.name || 'Nicht zugeordnet',
      studentId: submission.studentId,
      classId: submission.exam.classId,
      fach: submission.exam.subject,
      datum: submission.createdAt.toLocaleDateString('de-CH'),
      gesamterzieltePunkte: submission.earnedPoints,
      gesamtmaximalPunkte: submission.exam.maxPoints,
      note: submission.gradeRounded,
      studentExamUrl: submission.studentExamUrl,
      aufgaben: submission.tasks.map((task) => ({
        aufgabeId: task.taskId,
        titel: task.title,
        schuelerAntwort: task.studentAnswer,
        erzieltePunkte: task.erzieltePunkte,
        maximalPunkte: task.maximalPunkte,
        status: task.status,
        lehrerKommentar: task.lehrerKommentar,
        schritte: task.schritte
          .map((step) => ({
            id: step.id,
            schrittIndex: step.schrittIndex,
            schrittText: step.schrittText,
            istKorrekt: step.istKorrekt,
            fehlerTyp: step.fehlerTyp,
            erreichtePunkte: step.erreichtePunkte,
            maximalPunkte: step.maximalPunkte,
            begruendung: step.begruendung,
          }))
          .sort((a, b) => a.schrittIndex - b.schrittIndex),
      })),
      schuelerFeedback: {
        staerken: submission.strengths,
        schwaechen: submission.weaknesses,
        hilfreicherTipp: submission.helpfulTip || '',
        uebungsEmpfehlung: submission.exerciseRecommendation || '',
      },
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Korrektur.' }, { status: 500 });
  }
}

// POST: Save updated teacher points, comments, and recalculate grades
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: submissionId } = await params;
    const body = await request.json();
    const { aufgaben, schuelerFeedback } = body; // Array of updated tasks + optional student feedback

    if (!Array.isArray(aufgaben)) {
      return NextResponse.json({ error: 'Ungültige Aufgaben-Daten.' }, { status: 400 });
    }

    // Load the existing submission to verify and get max points
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

    // Verify teacher ownership
    if (submission.exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // Run dynamic point updates and Swiss grade recalculation in a single transaction
    const updatedSubmission = await db.$transaction(async (tx) => {
      let totalEarnedPoints = 0;

      for (const updatedTask of aufgaben) {
        let taskPoints = 0;

        // 1. Update individual steps
        if (Array.isArray(updatedTask.schritte)) {
          for (const updatedStep of updatedTask.schritte) {
            // Clamp points between 0 and max
            const clampedPoints = Math.max(
              0,
              Math.min(updatedStep.maximalPunkte, updatedStep.erreichtePunkte)
            );
            taskPoints += clampedPoints;

            // If step ID is present, update in DB
            if (updatedStep.id) {
              await tx.stepCorrection.update({
                where: { id: updatedStep.id },
                data: {
                  erreichtePunkte: clampedPoints,
                },
              });
            }
          }
        }

        totalEarnedPoints += taskPoints;

        // 2. Update parent TaskCorrection
        await tx.taskCorrection.updateMany({
          where: {
            submissionId: submissionId,
            taskId: updatedTask.aufgabeId,
          },
          data: {
            erzieltePunkte: taskPoints,
            lehrerKommentar: updatedTask.lehrerKommentar || '',
          },
        });
      }

      // 3. Recalculate Schweizer Schulnote
      // Formel: Note = 5 * (erzieltePunkte / maximalPunkte) + 1
      const maxScore = submission.exam.maxPoints;
      const rawGrade = maxScore > 0 ? 5 * (totalEarnedPoints / maxScore) + 1 : 1;
      // Round to nearest 0.1 (e.g. 5.64 -> 5.6, 5.66 -> 5.7, etc.)
      const roundedGrade = (Math.round(rawGrade * 10) / 10).toFixed(1);

      // 4. Update the Submission details
      const finalSubmission = await tx.submission.update({
        where: { id: submissionId },
        data: {
          earnedPoints: totalEarnedPoints,
          gradeRaw: rawGrade,
          gradeRounded: roundedGrade,
          helpfulTip:
            schuelerFeedback?.hilfreicherTipp !== undefined
              ? schuelerFeedback.hilfreicherTipp
              : undefined,
          exerciseRecommendation:
            schuelerFeedback?.uebungsEmpfehlung !== undefined
              ? schuelerFeedback.uebungsEmpfehlung
              : undefined,
        },
      });

      return finalSubmission;
    });

    return NextResponse.json({
      success: true,
      earnedPoints: updatedSubmission.earnedPoints,
      gradeRounded: updatedSubmission.gradeRounded,
    });
  } catch (error) {
    console.error('Error updating submission:', error);
    return NextResponse.json({ error: 'Speichern fehlgeschlagen.' }, { status: 500 });
  }
}

// PATCH: Update studentId for manual mapping / AI Auto-Matching override
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: submissionId } = await params;
    const body = await request.json();
    const { studentId } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Schüler-ID fehlt.' }, { status: 400 });
    }

    // Load the submission
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

    // Verify ownership
    if (submission.exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // Verify student exists in the same class
    const student = await db.student.findUnique({
      where: { id: studentId },
    });

    if (!student || student.classId !== submission.exam.classId) {
      return NextResponse.json({ error: 'Ungültiger Schüler für diese Klasse.' }, { status: 400 });
    }

    // Check if a submission already exists for this exam and student
    const existingSubmission = await db.submission.findFirst({
      where: {
        examId: submission.examId,
        studentId: studentId,
        id: { not: submissionId },
      },
    });

    if (existingSubmission) {
      return NextResponse.json(
        {
          error: 'Für diesen Schüler existiert bereits eine Korrektur für diese Prüfung.',
          code: 'DUPLICATE_SUBMISSION',
        },
        { status: 409 }
      );
    }

    // Update studentId
    const updated = await db.submission.update({
      where: { id: submissionId },
      data: { studentId },
      include: { student: true },
    });

    return NextResponse.json({
      success: true,
      studentId: updated.studentId,
      studentName: updated.student?.name,
    });
  } catch (error) {
    console.error('Error assigning student to submission:', error);
    return NextResponse.json({ error: 'Zuweisung fehlgeschlagen.' }, { status: 500 });
  }
}
