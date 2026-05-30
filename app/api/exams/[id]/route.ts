import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET: Fetch exam details, statistics, and submissions tracking (all class students)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: examId } = await params;

    // Fetch exam details and verify class/teacher ownership
    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: {
        class: {
          include: {
            students: true,
          },
        },
        submissions: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Prüfung nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns class
    if (exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // 1. Calculate stats across COMPLETED submissions for this exam
    const completedSubmissions = exam.submissions.filter((s) => s.status === 'COMPLETED');
    const totalCompleted = completedSubmissions.length;

    let averageGrade = 0;
    let passingCount = 0;
    let highestGrade = 0;
    let lowestGrade = 6.0;
    let stdDev = 0;
    const gradeDistribution = {
      '1.0-2.0': 0,
      '2.0-3.0': 0,
      '3.0-4.0': 0,
      '4.0-5.0': 0,
      '5.0-6.0': 0,
    };

    if (totalCompleted > 0) {
      const grades = completedSubmissions.map((sub) => sub.gradeRaw);
      const sum = grades.reduce((a, b) => a + b, 0);
      averageGrade = sum / totalCompleted;

      grades.forEach((g) => {
        if (g >= 4.0) passingCount++;
        if (g > highestGrade) highestGrade = g;
        if (g < lowestGrade) lowestGrade = g;

        // Bucketing for distribution histogram
        if (g >= 1.0 && g < 2.0) gradeDistribution['1.0-2.0']++;
        else if (g >= 2.0 && g < 3.0) gradeDistribution['2.0-3.0']++;
        else if (g >= 3.0 && g < 4.0) gradeDistribution['3.0-4.0']++;
        else if (g >= 4.0 && g < 5.0) gradeDistribution['4.0-5.0']++;
        else if (g >= 5.0 && g <= 6.0) gradeDistribution['5.0-6.0']++;
      });

      // Calculate Standard Deviation
      const variance =
        grades.reduce((sqSum, val) => sqSum + Math.pow(val - averageGrade, 2), 0) / totalCompleted;
      stdDev = Math.sqrt(variance);
    } else {
      lowestGrade = 0;
    }

    // 2. Track submission status for ALL class students (to identify who has NOT taken/completed the exam)
    const submissionsTracker = exam.class.students.map((student) => {
      const existingSub = exam.submissions.find((s) => s.studentId === student.id);

      return {
        studentId: student.id,
        studentName: student.name,
        submissionId: existingSub?.id || null,
        status: existingSub ? existingSub.status : 'UNSTARTED', // COMPLETED, DRAFT, UNSTARTED
        grade: existingSub && existingSub.status === 'COMPLETED' ? existingSub.gradeRounded : 'N/A',
        earnedPoints: existingSub ? existingSub.earnedPoints.toFixed(1) : 'N/A',
        date: existingSub ? existingSub.createdAt.toLocaleDateString('de-CH') : 'N/A',
      };
    });

    const stats = {
      averageGrade: averageGrade > 0 ? averageGrade.toFixed(2) : 'N/A',
      passRate:
        totalCompleted > 0 ? ((passingCount / totalCompleted) * 100).toFixed(1) + '%' : '0%',
      highestGrade: highestGrade > 0 ? highestGrade.toFixed(1) : 'N/A',
      lowestGrade: lowestGrade > 0 ? lowestGrade.toFixed(1) : 'N/A',
      stdDev: stdDev > 0 ? stdDev.toFixed(2) : '0.00',
      totalCompleted,
      totalStudents: exam.class.students.length,
      gradeDistribution,
    };

    return NextResponse.json({
      exam: {
        id: exam.id,
        title: exam.title,
        subject: exam.subject,
        maxPoints: exam.maxPoints,
        rubricText: exam.rubricText,
        classId: exam.classId,
        className: exam.class.name,
        createdAt: exam.createdAt.toLocaleDateString('de-CH'),
      },
      stats,
      roster: submissionsTracker,
    });
  } catch (error) {
    console.error('Error fetching exam details:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Prüfungsdetails.' }, { status: 500 });
  }
}

// PUT: Update exam fields or rubric text
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: examId } = await params;
    const body = await request.json();
    const { title, subject, rubricText, maxPoints } = body;

    // Fetch existing exam
    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { class: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Prüfung nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns class
    if (exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    if (maxPoints !== undefined && (typeof maxPoints !== 'number' || maxPoints <= 0)) {
      return NextResponse.json({ error: 'Maximale Punktzahl muss positiv sein.' }, { status: 400 });
    }

    const updatedExam = await db.exam.update({
      where: { id: examId },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        subject: subject !== undefined ? subject.trim() : undefined,
        rubricText: rubricText !== undefined ? rubricText : undefined,
        maxPoints: maxPoints !== undefined ? maxPoints : undefined,
      },
    });

    return NextResponse.json({ success: true, exam: updatedExam });
  } catch (error) {
    console.error('Error updating exam:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren der Prüfung.' }, { status: 500 });
  }
}

// DELETE: Delete exam (cascade deletes submissions)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: examId } = await params;

    // Fetch existing exam
    const exam = await db.exam.findUnique({
      where: { id: examId },
      include: { class: true },
    });

    if (!exam) {
      return NextResponse.json({ error: 'Prüfung nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns class
    if (exam.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    await db.exam.delete({
      where: { id: examId },
    });

    return NextResponse.json({ success: true, message: 'Prüfung erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Error deleting exam:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen der Prüfung.' }, { status: 500 });
  }
}
