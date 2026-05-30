import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const classes = await db.class.findMany({
      where: { teacherId: session.userId },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ classes });
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

    return NextResponse.json({ success: true, class: schoolClass });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen der Klasse.' }, { status: 500 });
  }
}
