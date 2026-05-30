import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import crypto from 'crypto';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: submissionId } = await params;
    const body = await request.json();
    const { taskId, title, maxPoints } = body;

    if (!taskId || !title || maxPoints === undefined) {
      return NextResponse.json({ error: 'Ungültige Parameter.' }, { status: 400 });
    }

    // Verify submission exists and teacher owns the class
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

    if (submission.exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // Check if task already exists in this submission
    const existingTask = await db.taskCorrection.findFirst({
      where: {
        submissionId,
        taskId: String(taskId),
      },
    });

    if (existingTask) {
      return NextResponse.json({ error: 'Aufgabe existiert bereits.' }, { status: 400 });
    }

    // Create the task correction and a default step correction
    await db.$transaction(async (tx) => {
      const taskCorrectionId = crypto.randomUUID();

      await tx.taskCorrection.create({
        data: {
          id: taskCorrectionId,
          submissionId,
          taskId: String(taskId),
          title,
          studentAnswer: 'Nicht eingereicht / Leer',
          erzieltePunkte: 0.0,
          maximalPunkte: Number(maxPoints),
          status: 'Fehler',
          lehrerKommentar: 'Nachträglich hinzugefügt.',
          orderIndex: 99, // Render at the end
        },
      });

      await tx.stepCorrection.create({
        data: {
          id: crypto.randomUUID(),
          taskCorrectionId,
          schrittIndex: 0,
          schrittText: 'Aufgabe nachträglich erfasst',
          istKorrekt: false,
          fehlerTyp: 'SonstigerFehler',
          erreichtePunkte: 0.0,
          maximalPunkte: Number(maxPoints),
          begruendung: 'Keine Antwort im Originalscan erkannt.',
        },
      });

      // Synchronize this task as a predefined ExamTask on the Exam level
      const existingExamTask = await tx.examTask.findFirst({
        where: { examId: submission.examId, taskId: String(taskId) },
      });

      if (!existingExamTask) {
        await tx.examTask.create({
          data: {
            examId: submission.examId,
            taskId: String(taskId),
            title: title,
            maxPoints: Number(maxPoints),
            orderIndex: 99,
          },
        });
      }

      // Recompute the exam's total max points as the sum of all ExamTasks
      const examTasks = await tx.examTask.findMany({
        where: { examId: submission.examId },
      });
      const totalExamMaxPoints = examTasks.reduce((sum, t) => sum + t.maxPoints, 0);

      await tx.exam.update({
        where: { id: submission.examId },
        data: { maxPoints: totalExamMaxPoints },
      });

      // Recalculate grades for all submissions of this exam to maintain absolute class-wide consistency
      const siblingSubmissions = await tx.submission.findMany({
        where: { examId: submission.examId },
        include: { tasks: true },
      });

      for (const sibling of siblingSubmissions) {
        let siblingEarned = sibling.tasks.reduce((sum, t) => sum + t.erzieltePunkte, 0);

        // If it is the current submission, include the new task we just added (currently has 0 points)
        if (sibling.id === submissionId) {
          // The task correction we created above is already linked in the DB but sibling.tasks might not have it yet in memory
          if (!sibling.tasks.some((t) => t.taskId === String(taskId))) {
            siblingEarned += 0.0;
          }
        }

        const rawGrade = totalExamMaxPoints > 0 ? 5 * (siblingEarned / totalExamMaxPoints) + 1 : 1;
        const roundedGrade = (Math.round(rawGrade * 10) / 10).toFixed(1);

        await tx.submission.update({
          where: { id: sibling.id },
          data: {
            earnedPoints: siblingEarned,
            gradeRaw: rawGrade,
            gradeRounded: roundedGrade,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding task correction:', error);
    return NextResponse.json(
      { error: 'Aufgabe konnte nicht hinzugefügt werden.' },
      { status: 500 }
    );
  }
}
