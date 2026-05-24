import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const exams = await db.exam.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    console.error('Error fetching exams:', error);
    return NextResponse.json({ error: 'Fehler beim Laden der Prüfungen.' }, { status: 500 });
  }
}
