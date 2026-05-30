import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    // Await params promise in Next.js 16
    const { id: classId } = await params;

    // Verify class belongs to this teacher
    const schoolClass = await db.class.findFirst({
      where: { id: classId, teacherId: session.userId },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Klasse nicht gefunden.' }, { status: 404 });
    }

    const students = await db.student.findMany({
      where: { classId },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ students });
  } catch (error) {
    console.error('Error fetching students:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Schüler.' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const { id: classId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Schülername ist erforderlich.' }, { status: 400 });
    }

    // Verify class belongs to this teacher
    const schoolClass = await db.class.findFirst({
      where: { id: classId, teacherId: session.userId },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Klasse nicht gefunden.' }, { status: 404 });
    }

    const student = await db.student.create({
      data: {
        name: name.trim(),
        classId,
      },
    });

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error('Error creating student:', error);
    return NextResponse.json({ error: 'Fehler beim Erstellen des Schülers.' }, { status: 500 });
  }
}
