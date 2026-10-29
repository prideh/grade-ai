import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT, signMobileRelayToken, verifyMobileRelayToken } from '@/lib/jwt';

describe('JWT & Mobile Relay Cryptographic Verification (lib/jwt.ts)', () => {
  it('signs and verifies teacher session JWTs', async () => {
    const token = await signJWT({ userId: 'teacher-123' }, '1h');
    const verified = await verifyJWT(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('teacher-123');
  });

  it('prevents mobile relay tokens from being used as full teacher session JWTs', async () => {
    const relayToken = await signMobileRelayToken({
      teacherId: 'teacher-123',
      targetMode: 'SUBMISSION',
    });
    const sessionCheck = await verifyJWT(relayToken);
    expect(sessionCheck).toBeNull();
  });

  it('signs and verifies mobile relay tokens with locked targetMode, studentId, and submissionId', async () => {
    const relayToken = await signMobileRelayToken({
      teacherId: 'teacher-456',
      sessionId: 'sess-abc',
      targetMode: 'RUBRIC',
      classId: 'cls-1',
      examId: 'ex-1',
      studentId: 'stu-9',
      submissionId: 'sub-7',
    });

    const payload = await verifyMobileRelayToken(relayToken);
    expect(payload).not.toBeNull();
    expect(payload?.purpose).toBe('mobile_relay');
    expect(payload?.teacherId).toBe('teacher-456');
    expect(payload?.sessionId).toBe('sess-abc');
    expect(payload?.targetMode).toBe('RUBRIC');
    expect(payload?.classId).toBe('cls-1');
    expect(payload?.examId).toBe('ex-1');
    expect(payload?.studentId).toBe('stu-9');
    expect(payload?.submissionId).toBe('sub-7');
  });

  it('rejects tampered or malformed tokens', async () => {
    const token = await signMobileRelayToken({ teacherId: 'teacher-1' });
    const tampered = token.slice(0, -4) + 'XXXX';
    expect(await verifyMobileRelayToken(tampered)).toBeNull();
    expect(await verifyJWT(tampered)).toBeNull();
    expect(await verifyMobileRelayToken('')).toBeNull();
  });
});
