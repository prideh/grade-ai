import 'server-only';
import { cookies } from 'next/headers';
import { signJWT, verifyJWT } from './jwt';

const SESSION_COOKIE_NAME = 'grade_ai_session';

/**
 * Creates a secure cookie session containing a signed JSON Web Token (JWT).
 * @param userId Teacher's database ID
 */
export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity

  // Sign a professional-grade JWT
  const sessionToken = await signJWT({ userId }, '7d');

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Validates the active secure session and returns the teacher ID if verified.
 * @returns The session payload containing the userId if valid, otherwise null.
 */
export async function getSession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  // Verify JWT signature and expiration
  const payload = await verifyJWT(sessionToken);
  if (!payload) return null;

  return { userId: payload.userId };
}

/**
 * Deletes the secure session cookie to log the teacher out.
 */
export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
