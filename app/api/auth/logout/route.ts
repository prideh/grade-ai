import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';

export async function POST() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: 'Erfolgreich abgemeldet.' });
  } catch (error) {
    console.error('Error in logout API:', error);
    return NextResponse.json(
      { error: 'Abmeldung fehlgeschlagen.' },
      { status: 500 }
    );
  }
}
