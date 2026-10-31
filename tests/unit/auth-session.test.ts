import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as meGet } from '@/app/api/auth/me/route';
import * as sessionModule from '@/lib/session';
import { db } from '@/lib/db';
import {
  getCachedTeacher,
  setCachedTeacher,
  clearSessionCache,
  getHasCheckedAuth,
} from '@/lib/sessionCache';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    teacher: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Auth Session & /api/auth/me Reliability', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearSessionCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 when no session is present without deleting cookies', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue(null);

      const res = await meGet();
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.authenticated).toBe(false);

      // Crucial: Must NOT send a Set-Cookie header deleting the cookie,
      // avoiding race conditions with concurrent login/register POST requests
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });

    it('returns 401 when teacher is not found in database without deleting cookies', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue({ userId: 'teacher-deleted' });
      vi.mocked(db.teacher.findUnique).mockResolvedValue(null);

      const res = await meGet();
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.authenticated).toBe(false);
      expect(json.error).toBe('Benutzer existiert nicht mehr.');

      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });

    it('returns 200 with teacher data when session is valid and teacher exists', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue({ userId: 'teacher-1' });
      vi.mocked(db.teacher.findUnique).mockResolvedValue({
        id: 'teacher-1',
        name: 'Frau Meier',
        email: 'meier@schule.ch',
      } as unknown as Awaited<ReturnType<typeof db.teacher.findUnique>>);

      const res = await meGet();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.teacher).toEqual({
        id: 'teacher-1',
        name: 'Frau Meier',
        email: 'meier@schule.ch',
      });
    });

    it('returns 500 with error message on unexpected database errors', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue({ userId: 'teacher-err' });
      vi.mocked(db.teacher.findUnique).mockRejectedValue(new Error('DB disconnect'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await meGet();
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.authenticated).toBe(false);
      expect(json.error).toBe('Interner Serverfehler.');
      consoleSpy.mockRestore();
    });
  });

  describe('Session Cache (lib/sessionCache.ts)', () => {
    it('handles cache correctly in environment', () => {
      // In Node environment without window, helpers guard gracefully
      expect(getCachedTeacher()).toBeNull();
      expect(getHasCheckedAuth()).toBe(false);

      // Simulate browser window environment
      const fakeWindow = {} as unknown as Window & typeof globalThis;
      const originalWindow = global.window;
      global.window = fakeWindow;

      try {
        expect(getCachedTeacher()).toBeNull();
        expect(getHasCheckedAuth()).toBe(false);

        const sampleTeacher = {
          id: 't-123',
          name: 'Herr Schweizer',
          email: 'schweizer@schule.ch',
        };

        setCachedTeacher(sampleTeacher);
        expect(getCachedTeacher()).toEqual(sampleTeacher);
        expect(getHasCheckedAuth()).toBe(true);

        clearSessionCache();
        expect(getCachedTeacher()).toBeNull();
        expect(getHasCheckedAuth()).toBe(false);
      } finally {
        global.window = originalWindow;
      }
    });
  });

  describe('Schweizer Rechtschreibung (kein Eszett)', () => {
    it('enthaelt kein Eszett in allen veraenderten Dateien', () => {
      const filesToCheck = [
        '../../app/api/auth/me/route.ts',
        '../../app/login/page.tsx',
        '../../app/register/page.tsx',
        '../../components/DashboardLayout.tsx',
        '../../proxy.ts',
      ];

      for (const rel of filesToCheck) {
        const fullPath = path.resolve(__dirname, rel);
        const content = fs.readFileSync(fullPath, 'utf-8');
        expect(content, `Datei ${rel} enthaelt Eszett`).not.toContain('\u00DF');
      }
    });
  });
});
