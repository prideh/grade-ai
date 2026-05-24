import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET: Fetch student details, analytics, grade trajectory, and AI feedback aggregation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: studentId } = await params;

    // Fetch student and verify teacher ownership
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        class: true,
        submissions: {
          include: {
            exam: true,
          },
          orderBy: {
            createdAt: 'asc', // Chronological order for trajectory plotting
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Schüler nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns the student's class
    if (student.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // 1. Filter completed submissions for calculations
    const completedSubmissions = student.submissions.filter((s) => s.status === 'COMPLETED');
    const totalExamsCorrected = completedSubmissions.length;

    let averageGrade = 0;
    const strengthsSet = new Set<string>();
    const weaknessesSet = new Set<string>();
    const helpfulTips: string[] = [];

    if (totalExamsCorrected > 0) {
      const sum = completedSubmissions.reduce((a, b) => a + b.gradeRaw, 0);
      averageGrade = sum / totalExamsCorrected;

      completedSubmissions.forEach((s) => {
        s.strengths.forEach((st) => strengthsSet.add(st));
        s.weaknesses.forEach((we) => weaknessesSet.add(we));
        if (s.helpfulTip) helpfulTips.push(s.helpfulTip);
      });
    }

    // 2. Fetch the class average for comparison
    const allClassSubmissions = await db.submission.findMany({
      where: {
        status: 'COMPLETED',
        student: {
          classId: student.classId,
        },
      },
    });
    
    let classAverage = 0;
    if (allClassSubmissions.length > 0) {
      const sum = allClassSubmissions.reduce((a, b) => a + b.gradeRaw, 0);
      classAverage = sum / allClassSubmissions.length;
    }

    // 3. Map trajectory for MUI Line Chart
    const trajectory = completedSubmissions.map((s) => ({
      id: s.id,
      date: s.createdAt.toLocaleDateString('de-CH'),
      examTitle: s.exam.title,
      grade: s.gradeRaw, // Numeric value for line chart
      gradeRounded: s.gradeRounded, // Display string
      earnedPoints: s.earnedPoints,
      maxPoints: s.exam.maxPoints,
    }));

    // 4. Detailed submission list
    const submissionsList = student.submissions.map((s) => ({
      id: s.id,
      examId: s.examId,
      examTitle: s.exam.title,
      subject: s.exam.subject,
      status: s.status,
      grade: s.gradeRounded,
      points: `${s.earnedPoints.toFixed(1)} / ${s.exam.maxPoints}`,
      date: s.createdAt.toLocaleDateString('de-CH'),
    }));

    return NextResponse.json({
      student: {
        id: student.id,
        name: student.name,
        classId: student.classId,
        className: student.class.name,
        createdAt: student.createdAt.toLocaleDateString('de-CH'),
      },
      stats: {
        averageGrade: averageGrade > 0 ? averageGrade.toFixed(2) : 'N/A',
        classAverage: classAverage > 0 ? classAverage.toFixed(2) : 'N/A',
        totalExamsCorrected,
        strengths: Array.from(strengthsSet),
        weaknesses: Array.from(weaknessesSet),
        helpfulTips,
      },
      trajectory,
      submissions: submissionsList,
    });
  } catch (error) {
    console.error('Error fetching student details:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Schülerdetails.' }, { status: 500 });
  }
}

// PUT: Update student name or transfer class
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: studentId } = await params;
    const body = await request.json();
    const { name, classId } = body;

    // Fetch existing student
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Schüler nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns current class
    if (student.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    // If transferring class, verify teacher owns new class
    if (classId && classId !== student.classId) {
      const newClass = await db.class.findFirst({
        where: { id: classId, teacherId: session.userId },
      });
      if (!newClass) {
        return NextResponse.json({ error: 'Neue Klasse nicht gefunden.' }, { status: 404 });
      }
    }

    const updatedStudent = await db.student.update({
      where: { id: studentId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        classId: classId !== undefined ? classId : undefined,
      },
    });

    return NextResponse.json({ success: true, student: updatedStudent });
  } catch (error) {
    console.error('Error updating student:', error);
    return NextResponse.json({ error: 'Fehler beim Aktualisieren des Schülers.' }, { status: 500 });
  }
}

// DELETE: Delete student (cascade deletes submissions)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: studentId } = await params;

    // Fetch existing student
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json({ error: 'Schüler nicht gefunden.' }, { status: 404 });
    }

    // Verify teacher owns class
    if (student.class.teacherId !== session.userId) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 403 });
    }

    await db.student.delete({
      where: { id: studentId },
    });

    return NextResponse.json({ success: true, message: 'Schüler erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Error deleting student:', error);
    return NextResponse.json({ error: 'Fehler beim Löschen des Schülers.' }, { status: 500 });
  }
}
