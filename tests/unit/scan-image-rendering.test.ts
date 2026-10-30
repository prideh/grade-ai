import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { GET as uploadsGet } from '@/app/uploads/[...file]/route';
import * as sessionModule from '@/lib/session';
import { db } from '@/lib/db';
import { StorageAdapter } from '@/lib/storage';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    submission: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Scan-Bilder im Korrektur-Arbeitsbereich (Issue #35)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Unoptimiertes Rendering in app/correct/[id]/page.tsx', () => {
    it('verwendet das unoptimized-Attribut fuer Scans, um 401-Fehler des Next.js Optimizers zu verhindern', () => {
      const pagePath = path.join(process.cwd(), 'app', 'correct', '[id]', 'page.tsx');
      const pageContent = fs.readFileSync(pagePath, 'utf-8');

      // Prüfe, dass next/image importiert wird
      expect(pageContent).toContain("import Image from 'next/image';");

      // Prüfe, dass das unoptimized-Prop auf dem Scan-Image-Tag gesetzt ist
      const hasUnoptimizedImage =
        /<Image[\s\S]*?src=\{activeUrl\}[\s\S]*?unoptimized[\s\S]*?\/>/.test(pageContent);
      expect(hasUnoptimizedImage).toBe(true);
    });
  });

  describe('Schutz der /uploads-Route bleibt unverändert bestehen', () => {
    it('gibt ohne gueltige Sitzung HTTP 401 zurueck', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue(null);

      const req = new Request('http://localhost:3000/uploads/scan_p1.png');
      const res = await uploadsGet(req, {
        params: Promise.resolve({ file: ['scan_p1.png'] }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Nicht autorisiert.');
    });

    it('gibt bei fremdem Scan HTTP 403 zurueck', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue({ userId: 'teacher-owner' });
      vi.mocked(db.submission.findFirst).mockResolvedValue({
        id: 'sub-other',
        studentExamUrl: '/uploads/scan_p1.png',
        exam: {
          class: {
            teacherId: 'different-teacher',
          },
        },
      } as unknown as Awaited<ReturnType<typeof db.submission.findFirst>>);

      const req = new Request('http://localhost:3000/uploads/scan_p1.png');
      const res = await uploadsGet(req, {
        params: Promise.resolve({ file: ['scan_p1.png'] }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Keine Berechtigung fuer diesen Scan.');
    });

    it('liefert autorisiertem Lehrer das Bild mit HTTP 200 zurueck', async () => {
      vi.mocked(sessionModule.getSession).mockResolvedValue({ userId: 'teacher-owner' });
      vi.mocked(db.submission.findFirst).mockResolvedValue({
        id: 'sub-owner',
        studentExamUrl: '/uploads/scan_p1.png',
        exam: {
          class: {
            teacherId: 'teacher-owner',
          },
        },
      } as unknown as Awaited<ReturnType<typeof db.submission.findFirst>>);

      const mockBuffer = Buffer.from('PNG_IMAGE_DATA');
      const mockStorage = {
        read: vi.fn().mockResolvedValue({ buffer: mockBuffer, contentType: 'image/png' }),
        write: vi.fn(),
        delete: vi.fn(),
        exists: vi.fn(),
        getUrl: vi.fn(),
      };

      const storageModule = await import('@/lib/storage');
      vi.spyOn(storageModule, 'getStorageAdapter').mockReturnValue(
        mockStorage as unknown as StorageAdapter
      );

      const req = new Request('http://localhost:3000/uploads/scan_p1.png');
      const res = await uploadsGet(req, {
        params: Promise.resolve({ file: ['scan_p1.png'] }),
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      const received = Buffer.from(await res.arrayBuffer());
      expect(received.toString()).toBe('PNG_IMAGE_DATA');
    });
  });

  describe('Schweizer Hochdeutsch (Kein Eszett)', () => {
    it('stellt sicher, dass in app/correct/[id]/page.tsx keine Eszett-Zeichen vorkommen', () => {
      const pagePath = path.join(process.cwd(), 'app', 'correct', '[id]', 'page.tsx');
      const content = fs.readFileSync(pagePath, 'utf-8');
      const eszett = String.fromCharCode(0xdf);
      expect(content).not.toContain(eszett);
    });
  });
});
