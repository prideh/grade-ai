import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const logs = await db.correctionLog.findMany({
      where: {
        teacherId: session.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Error fetching correction logs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Korrektur-Protokolls.' },
      { status: 500 }
    );
  }
}
