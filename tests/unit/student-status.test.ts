import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getStudent } from '@/app/api/students/[id]/route';
import * as sessionModule from '@/lib/session';
import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  serverCache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    invalidateTags: vi.fn(),
  },
  CacheTags: {
    teacher: vi.fn(),
    student: vi.fn(),
    students: vi.fn(),
    class: vi.fn(),
    logs: vi.fn(),
  },
  invalidateStudentCache: vi.fn(),
  invalidateLogsCache: vi.fn(),
}));

vi.mock('@/lib/storage-cleanup', () => ({
  deleteStudentScanFiles: vi.fn(),
  StorageCleanupError: class StorageCleanupError extends Error {},
}));

vi.mock('@/lib/db', () => ({
  db: {
    student: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
    class: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Schülerstatus bei 0 benoteten Arbeiten (Issue #40)', () => {
  const mockTeacherId = 'teacher-1';
  const mockStudentId = 'student-1';
  const mockClassId = 'class-1';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(sessionModule.getSession).mockResolvedValue({
      userId: mockTeacherId,
    });
  });

  describe('GET /api/students/[id] Status-Ableitung', () => {
    it('gibt bei frisch eingeschriebenem Schüler ohne Arbeiten den Status "Keine Daten" zurück', async () => {
      vi.mocked(db.student.findUnique).mockResolvedValueOnce({
        id: mockStudentId,
        name: 'Anna Neu',
        classId: mockClassId,
        createdAt: new Date('2026-10-31'),
        class: {
          id: mockClassId,
          name: 'Sek 1a',
          teacherId: mockTeacherId,
        },
        submissions: [],
      } as unknown as Awaited<ReturnType<typeof db.student.findUnique>>);

      vi.mocked(db.submission.findMany).mockResolvedValueOnce([]);

      const req = new Request(`http://localhost/api/students/${mockStudentId}`, {
        method: 'GET',
      });

      const res = await getStudent(req, {
        params: Promise.resolve({ id: mockStudentId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.stats.totalExamsCorrected).toBe(0);
      expect(json.stats.averageGrade).toBe('N/A');
      expect(json.stats.status).toBe('Keine Daten');
      expect(json.stats.status).not.toBe('Ungenügend');
    });

    it('gibt bei bestandenem Notenschnitt den Status "Genügend" zurück', async () => {
      vi.mocked(db.student.findUnique).mockResolvedValueOnce({
        id: mockStudentId,
        name: 'Max Muster',
        classId: mockClassId,
        createdAt: new Date('2026-10-31'),
        class: {
          id: mockClassId,
          name: 'Sek 1a',
          teacherId: mockTeacherId,
        },
        submissions: [
          {
            id: 'sub-1',
            status: 'COMPLETED',
            gradeRaw: 5.0,
            gradeRounded: '5.0',
            earnedPoints: 25,
            strengths: ['Gute Argumentation'],
            weaknesses: [],
            helpfulTip: 'Weiter so',
            createdAt: new Date('2026-10-31'),
            examId: 'exam-1',
            exam: { title: 'Deutsch Prüfung', subject: 'Deutsch', maxPoints: 30 },
          },
        ],
      } as unknown as Awaited<ReturnType<typeof db.student.findUnique>>);

      vi.mocked(db.submission.findMany).mockResolvedValueOnce([
        { gradeRaw: 4.5 } as unknown as Awaited<ReturnType<typeof db.submission.findMany>>[0],
      ]);

      const req = new Request(`http://localhost/api/students/${mockStudentId}`, {
        method: 'GET',
      });

      const res = await getStudent(req, {
        params: Promise.resolve({ id: mockStudentId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.stats.totalExamsCorrected).toBe(1);
      expect(json.stats.averageGrade).toBe('5.00');
      expect(json.stats.status).toBe('Genügend');
    });

    it('gibt bei ungenügendem Notenschnitt den Status "Ungenügend" zurück', async () => {
      vi.mocked(db.student.findUnique).mockResolvedValueOnce({
        id: mockStudentId,
        name: 'Fritz Test',
        classId: mockClassId,
        createdAt: new Date('2026-10-31'),
        class: {
          id: mockClassId,
          name: 'Sek 1a',
          teacherId: mockTeacherId,
        },
        submissions: [
          {
            id: 'sub-2',
            status: 'COMPLETED',
            gradeRaw: 3.5,
            gradeRounded: '3.5',
            earnedPoints: 12,
            strengths: [],
            weaknesses: ['Rechtschreibung'],
            helpfulTip: 'Regeln wiederholen',
            createdAt: new Date('2026-10-31'),
            examId: 'exam-2',
            exam: { title: 'Mathe Test', subject: 'Mathematik', maxPoints: 30 },
          },
        ],
      } as unknown as Awaited<ReturnType<typeof db.student.findUnique>>);

      vi.mocked(db.submission.findMany).mockResolvedValueOnce([
        { gradeRaw: 4.0 } as unknown as Awaited<ReturnType<typeof db.submission.findMany>>[0],
      ]);

      const req = new Request(`http://localhost/api/students/${mockStudentId}`, {
        method: 'GET',
      });

      const res = await getStudent(req, {
        params: Promise.resolve({ id: mockStudentId }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.stats.totalExamsCorrected).toBe(1);
      expect(json.stats.averageGrade).toBe('3.50');
      expect(json.stats.status).toBe('Ungenügend');
    });
  });

  describe('UI Schülerprofil Statusanzeige (app/students/[id]/page.tsx)', () => {
    it('zeigt "Keine Daten" anstelle von "Ungenügend" wenn keine Arbeiten korrigiert wurden', () => {
      const fileContent = fs.readFileSync(
        path.resolve(__dirname, '../../app/students/[id]/page.tsx'),
        'utf-8'
      );

      // Verify neutral status check
      expect(fileContent).toContain("'Keine Daten'");
      expect(fileContent).toContain(
        "stats.totalExamsCorrected === 0 || stats.averageGrade === 'N/A'"
      );
    });

    it('enthält kein "ß" (Schweizer Hochdeutsch)', () => {
      const studentPage = fs.readFileSync(
        path.resolve(__dirname, '../../app/students/[id]/page.tsx'),
        'utf-8'
      );
      const studentApi = fs.readFileSync(
        path.resolve(__dirname, '../../app/api/students/[id]/route.ts'),
        'utf-8'
      );

      expect(studentPage).not.toContain('ß');
      expect(studentApi).not.toContain('ß');
    });
  });
});
