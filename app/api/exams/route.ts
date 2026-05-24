import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

// GET: Fetch all exams created by the teacher across all their classes
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const exams = await db.exam.findMany({
      where: {
        class: {
          teacherId: session.userId,
        },
      },
      include: {
        class: true,
        _count: {
          select: {
            submissions: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formatted = exams.map((ex) => ({
      id: ex.id,
      title: ex.title,
      subject: ex.subject,
      maxPoints: ex.maxPoints,
      rubricText: ex.rubricText,
      classId: ex.classId,
      className: ex.class.name,
      createdAt: ex.createdAt.toLocaleDateString('de-CH'),
      submissionsCount: ex._count.submissions,
    }));

    return NextResponse.json({ exams: formatted });
  } catch (error) {
    console.error('Error fetching global exams:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Prüfungen.' }, { status: 500 });
  }
}

// POST: Create a new exam explicitly
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const body = await request.json();
    const { title, subject, rubricText, maxPoints, classId } = body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return NextResponse.json({ error: 'Prüfungstitel ist erforderlich.' }, { status: 400 });
    }

    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return NextResponse.json({ error: 'Fach ist erforderlich.' }, { status: 400 });
    }

    if (maxPoints === undefined || typeof maxPoints !== 'number' || maxPoints <= 0) {
      return NextResponse.json({ error: 'Maximale Punktzahl muss eine positive Zahl sein.' }, { status: 400 });
    }

    if (!classId || typeof classId !== 'string') {
      return NextResponse.json({ error: 'Klasse muss ausgewählt sein.' }, { status: 400 });
    }

    // Verify class belongs to this teacher
    const schoolClass = await db.class.findFirst({
      where: { id: classId, teacherId: session.userId },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Klasse nicht gefunden.' }, { status: 404 });
    }

    const exam = await db.exam.create({
      data: {
        title: title.trim(),
        subject: subject.trim(),
        rubricText: rubricText || 'Standard Musterlösung',
        maxPoints,
        classId,
      },
    });

    return NextResponse.json({ success: true, exam });
  } catch (error) {
    console.error('Error creating exam:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen der Prüfung.' }, { status: 500 });
  }
}
