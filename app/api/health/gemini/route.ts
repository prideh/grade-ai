import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { checkGeminiHealth } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert.' }, { status: 401 });
    }

    const health = await checkGeminiHealth();
    return NextResponse.json(health);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: 0,
        errorCategory: 'UNKNOWN',
      },
      { status: 500 }
    );
  }
}
