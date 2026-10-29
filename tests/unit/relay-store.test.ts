import { describe, it, expect } from 'vitest';
import { saveScannedRelayDocument, getScannedRelayDocument } from '@/lib/relay-store';

describe('Mobile Relay Document Store (lib/relay-store.ts)', () => {
  it('stores and retrieves scanned RUBRIC and EXAM_TEMPLATE payloads isolated by teacherId', () => {
    const sessionId = 'test-relay-session-1';
    saveScannedRelayDocument({
      id: 'doc-1',
      sessionId,
      teacherId: 'teacher-A',
      targetMode: 'RUBRIC',
      payload: '{"mimeType":"image/jpeg","data":"YWJj"}',
      pageCount: 2,
      createdAt: Date.now(),
    });

    // Authorized teacher retrieves the document
    const retrieved = getScannedRelayDocument(sessionId, 'teacher-A');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.pageCount).toBe(2);
    expect(retrieved?.targetMode).toBe('RUBRIC');
    expect(retrieved?.payload).toBe('{"mimeType":"image/jpeg","data":"YWJj"}');

    // Another teacher cannot read this session's document
    const unauthorized = getScannedRelayDocument(sessionId, 'teacher-B');
    expect(unauthorized).toBeNull();
  });
});
