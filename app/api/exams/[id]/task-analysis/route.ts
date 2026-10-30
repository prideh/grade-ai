import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { computeTaskAnalysis } from '@/lib/task-analysis';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: examId } = await params;

    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: {
        class: true,
        submissions: {
          include: {
            tasks: {
              orderBy: { orderIndex: 'asc' },
              include: {
                schritte: {
                  orderBy: { schrittIndex: 'asc' },
                },
              },
            },
          },
        },
        tasks: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Prüfung nicht gefunden.' }, { status: 404 });
    }

    if (exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    const taskAnalysis = computeTaskAnalysis(exam.tasks, exam.submissions);

    return NextResponse.json({
      success: true,
      taskAnalysis,
    });
  } catch (error) {
    console.error('Error fetching task analysis:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Aufgabenanalyse.' }, { status: 500 });
  }
}
