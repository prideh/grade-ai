import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { serverCache, CacheTags } from '@/lib/cache';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const cacheKey = `teacher:${session.userId}:logs:list`;
    const cached = await serverCache.get<{ logs: unknown[] }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const logs = await db.correctionLog.findMany({
      where: {
        teacherId: session.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const responsePayload = { logs };
    await serverCache.set(cacheKey, responsePayload, {
      tags: [CacheTags.teacher(session.userId), CacheTags.logs(session.userId)],
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error('Error fetching correction logs:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Korrektur-Protokolls.' },
      { status: 500 }
    );
  }
}
