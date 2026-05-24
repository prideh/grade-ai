import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    // Fetch all submissions for the teacher's classes
    const submissions = await db.submission.findMany({
      where: {
        exam: {
          class: {
            teacherId: session.userId,
          },
        },
      },
      include: {
        student: true,
        exam: {
          include: {
            class: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map database structures for client consumption
    const mapped = submissions.map((sub) => ({
      id: sub.id,
      studentId: sub.studentId,
      studentName: sub.student.name,
      examId: sub.examId,
      examTitle: sub.exam.title,
      classId: sub.exam.classId,
      className: sub.exam.class.name,
      subject: sub.exam.subject,
      grade: sub.gradeRounded,
      points: `${sub.earnedPoints.toFixed(1)} / ${sub.exam.maxPoints}`,
      status: sub.status,
      date: sub.createdAt.toLocaleDateString('de-CH'),
    }));

    return NextResponse.json({ submissions: mapped });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Korrekturen.' }, { status: 500 });
  }
}

