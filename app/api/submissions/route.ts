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

    // Fetch all students for the teacher's classes to resolve targetStudentId names without N+1 queries
    const teacherStudents = await db.student.findMany({
      where: {
        class: {
          teacherId: session.userId,
        },
      },
    });
    const studentMap = new Map(teacherStudents.map((s) => [s.id, s.name]));

    // Map database structures for client consumption
    const mapped = submissions.map((sub) => {
      const studentName =
        sub.student?.name ||
        (sub.targetStudentId ? studentMap.get(sub.targetStudentId) : null) ||
        'Nicht zugeordnet';

      return {
        id: sub.id,
        studentId: sub.studentId || sub.targetStudentId || null,
        studentName,
        examId: sub.examId,
        examTitle: sub.exam.title,
        classId: sub.exam.classId,
        className: sub.exam.class.name,
        subject: sub.exam.subject,
        grade: sub.status === 'COMPLETED' ? sub.gradeRounded : '—',
        points:
          sub.status === 'COMPLETED'
            ? `${sub.earnedPoints.toFixed(1)} / ${sub.exam.maxPoints}`
            : '—',
        status: sub.status,
        date: sub.createdAt.toLocaleDateString('de-CH'),
        errorMessage: sub.errorMessage,
      };
    });

    return NextResponse.json({ submissions: mapped });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Korrekturen.' }, { status: 500 });
  }
}
