import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    // Fetch submissions, students, and all exams (lightweight metadata) in parallel without N+1 or heavy rubric payloads
    const [submissions, teacherStudents, teacherExams] = await Promise.all([
      db.submission.findMany({
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
          tasks: {
            select: {
              schritte: {
                where: { istUnsicher: true },
                select: { id: true },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      db.student.findMany({
        where: {
          class: {
            teacherId: session.userId,
          },
        },
        select: {
          id: true,
          name: true,
          classId: true,
        },
        orderBy: {
          name: 'asc',
        },
      }),
      db.exam.findMany({
        where: {
          class: {
            teacherId: session.userId,
          },
        },
        select: {
          id: true,
          title: true,
          subject: true,
          classId: true,
          class: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const studentMap = new Map(teacherStudents.map((s) => [s.id, s.name]));
    const studentsByClass: Record<string, { id: string; name: string }[]> = {};
    for (const s of teacherStudents) {
      if (!studentsByClass[s.classId]) {
        studentsByClass[s.classId] = [];
      }
      studentsByClass[s.classId].push({ id: s.id, name: s.name });
    }

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
        extractedStudentName: sub.extractedStudentName,
        suggestedStudentId: sub.suggestedStudentId,
        isStudentMatchUncertain: sub.isStudentMatchUncertain,
        isExamMatchUncertain: sub.isExamMatchUncertain,
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
        uncertainStepsCount: sub.tasks.reduce((sum, t) => sum + t.schritte.length, 0),
      };
    });

    return NextResponse.json({
      submissions: mapped,
      studentsByClass,
      allExams: teacherExams.map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.subject,
        classId: e.classId,
        className: e.class.name,
      })),
      totalExamsCount: teacherExams.length,
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Korrekturen.' }, { status: 500 });
  }
}
