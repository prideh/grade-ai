import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      const response = NextResponse.json(
        { authenticated: false, error: 'Nicht autorisiert.' },
        { status: 401 }
      );
      response.cookies.delete('grade_ai_session');
      return response;
    }

    const teacher = await db.teacher.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!teacher) {
      const response = NextResponse.json(
        { authenticated: false, error: 'Benutzer existiert nicht mehr.' },
        { status: 401 }
      );
      response.cookies.delete('grade_ai_session');
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      teacher,
    });
  } catch (error) {
    console.error('Error fetching current teacher session:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Interner Serverfehler.' },
      { status: 500 }
    );
  }
}
