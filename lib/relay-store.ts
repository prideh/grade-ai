// Server-side in-memory store for QR Mobile Relay document scans (Musterlösung / Vorlagenprüfung)
// Persists across hot-reloads via globalThis so desktop dialogs receive mobile scans immediately,
// even before a new exam has been saved to PostgreSQL.

export type RelayTargetMode =
  | 'SUBMISSION'
  | 'RUBRIC'
  | 'EXAM_TEMPLATE'
  | 'REPLACE_SUBMISSION'
  | 'APPEND_SUBMISSION';

export interface ScannedRelayDocument {
  id: string;
  sessionId: string;
  teacherId: string;
  targetMode: 'RUBRIC' | 'EXAM_TEMPLATE';
  payload: string; // JSON string of { mimeType, data } or Array<{ mimeType, data }>
  pageCount: number;
  createdAt: number;
}

const globalForRelay = globalThis as unknown as {
  relayDocumentStore?: Map<string, ScannedRelayDocument>;
};

const store = globalForRelay.relayDocumentStore ?? new Map<string, ScannedRelayDocument>();
if (!globalForRelay.relayDocumentStore) {
  globalForRelay.relayDocumentStore = store;
}

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function pruneExpired() {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now - val.createdAt > TTL_MS) {
      store.delete(key);
    }
  }
}

export function saveScannedRelayDocument(doc: ScannedRelayDocument): void {
  pruneExpired();
  store.set(doc.sessionId, doc);
}

export function getScannedRelayDocument(
  sessionId: string | undefined | null,
  teacherId: string
): ScannedRelayDocument | null {
  if (!sessionId) return null;
  pruneExpired();
  const doc = store.get(sessionId);
  if (!doc || doc.teacherId !== teacherId) return null;
  return doc;
}
