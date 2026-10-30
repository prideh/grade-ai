import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { serverCache, CacheTags, invalidateClassCache } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const cacheKey = `teacher:${session.userId}:classes:list`;
    const cached = await serverCache.get<{ classes: unknown[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const rawClasses = await db.class.findMany({
      where: { teacherId: session.userId },
      include: {
        _count: {
          select: { students: true, exams: true },
        },
        exams: {
          select: {
            submissions: {
              where: { status: 'COMPLETED' },
              select: { gradeRaw: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const classes = rawClasses.map((cls) => {
      const allGrades = cls.exams.flatMap((ex) => ex.submissions.map((s) => s.gradeRaw));
      const avg =
        allGrades.length > 0
          ? (allGrades.reduce((sum, g) => sum + g, 0) / allGrades.length).toFixed(2)
          : 'N/A';

      return {
        id: cls.id,
        name: cls.name,
        teacherId: cls.teacherId,
        createdAt: cls.createdAt,
        _count: { students: cls._count.students },
        totalExams: cls._count.exams,
        averageGrade: avg,
      };
    });

    const responsePayload = { classes };
    await serverCache.set(cacheKey, responsePayload, {
      tags: [CacheTags.teacher(session.userId), CacheTags.classes(session.userId)],
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Klassen.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Klassenname ist erforderlich.' }, { status: 400 });
    }

    const existingClass = await db.class.findFirst({
      where: {
        name: name.trim(),
        teacherId: session.userId,
      },
    });

    if (existingClass) {
      return NextResponse.json(
        { error: 'Eine Klasse mit diesem Namen existiert bereits.' },
        { status: 400 }
      );
    }

    const schoolClass = await db.class.create({
      data: {
        name: name.trim(),
        teacherId: session.userId,
      },
    });

    await invalidateClassCache(session.userId);

    return NextResponse.json({ success: true, class: schoolClass });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen der Klasse.' }, { status: 500 });
  }
}
