import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { createSession } from '@/lib/session';

// Precomputed 16-byte hex salt + 64-byte hex key for constant-time dummy verification when user is not found
const DUMMY_PASSWORD_HASH = '00000000000000000000000000000000:' + '0'.repeat(128);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Bitte gib E-Mail und Passwort ein.' }, { status: 400 });
    }

    // Find the teacher by email
    const teacher = await db.teacher.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always run scrypt verification even if teacher is not found to prevent timing-based email enumeration
    const targetHash = teacher ? teacher.passwordHash : DUMMY_PASSWORD_HASH;
    const isPasswordValid = await verifyPassword(password, targetHash);

    if (!teacher || !isPasswordValid) {
      return NextResponse.json(
        { error: 'Ungültige E-Mail-Adresse oder Passwort.' },
        { status: 401 }
      );
    }

    // Set the session cookie
    await createSession(teacher.id);

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
      },
    });
  } catch (error) {
    console.error('Error in teacher login API:', error);
    return NextResponse.json(
      {
        error: 'Login fehlgeschlagen: ' + (error instanceof Error ? error.message : String(error)),
      },
      { status: 500 }
    );
  }
}
