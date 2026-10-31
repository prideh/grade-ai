import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT as updateClassPut, PATCH as updateClassPatch } from '@/app/api/classes/[id]/route';
import { POST as createClassPost } from '@/app/api/classes/route';
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
    class: vi.fn(),
    classes: vi.fn(),
    logs: vi.fn(),
  },
  invalidateClassCache: vi.fn(),
  invalidateLogsCache: vi.fn(),
}));

vi.mock('@/lib/storage-cleanup', () => ({
  deleteClassScanFiles: vi.fn(),
  StorageCleanupError: class StorageCleanupError extends Error {},
}));

vi.mock('@/lib/db', () => ({
  db: {
    class: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

describe('Klassenname Validierung und Header-Layout Robustheit', () => {
  const mockTeacherId = 'teacher-123';
  const mockClassId = 'class-456';

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(sessionModule.getSession).mockResolvedValue({
      userId: mockTeacherId,
    });
  });

  describe('PUT /api/classes/[id] Längenvalidierung', () => {
    it('lehnt Namen mit mehr als 100 Zeichen mit HTTP 400 ab', async () => {
      const longName = 'A'.repeat(101);
      const req = new Request(`http://localhost/api/classes/${mockClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName }),
      });

      const res = await updateClassPut(req, {
        params: Promise.resolve({ id: mockClassId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.');
      expect(db.class.update).not.toHaveBeenCalled();
    });

    it('lehnt 300-Zeichen-Namen mit HTTP 400 ab', async () => {
      const longName = '300-chars-'.repeat(30);
      const req = new Request(`http://localhost/api/classes/${mockClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName }),
      });

      const res = await updateClassPut(req, {
        params: Promise.resolve({ id: mockClassId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.');
      expect(db.class.update).not.toHaveBeenCalled();
    });

    it('akzeptiert PATCH als Alias für PUT und validiert ebenfalls', async () => {
      const longName = 'B'.repeat(105);
      const req = new Request(`http://localhost/api/classes/${mockClassId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName }),
      });

      const res = await updateClassPatch(req, {
        params: Promise.resolve({ id: mockClassId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.');
    });

    it('lehnt leere Klassennamen mit HTTP 400 ab', async () => {
      const req = new Request(`http://localhost/api/classes/${mockClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '   ' }),
      });

      const res = await updateClassPut(req, {
        params: Promise.resolve({ id: mockClassId }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Klassenname ist erforderlich.');
      expect(db.class.update).not.toHaveBeenCalled();
    });

    it('akzeptiert gültige Klassennamen bis 100 Zeichen und aktualisiert die Datenbank', async () => {
      const validName = '3. Sek A - Mathematik';
      vi.mocked(db.class.findFirst).mockResolvedValueOnce({
        id: mockClassId,
        name: 'Alte Klasse',
        teacherId: mockTeacherId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.class.findFirst>>);

      vi.mocked(db.class.update).mockResolvedValueOnce({
        id: mockClassId,
        name: validName,
        teacherId: mockTeacherId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.class.update>>);

      const req = new Request(`http://localhost/api/classes/${mockClassId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: validName }),
      });

      const res = await updateClassPut(req, {
        params: Promise.resolve({ id: mockClassId }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(db.class.update).toHaveBeenCalledWith({
        where: { id: mockClassId },
        data: { name: validName },
      });
    });
  });

  describe('POST /api/classes Längenvalidierung', () => {
    it('lehnt Erstellung von Klassen mit mehr als 100 Zeichen mit HTTP 400 ab', async () => {
      const longName = 'A'.repeat(101);
      const req = new Request('http://localhost/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName }),
      });

      const res = await createClassPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.');
      expect(db.class.create).not.toHaveBeenCalled();
    });

    it('lehnt leeren Klassennamen mit HTTP 400 ab', async () => {
      const req = new Request('http://localhost/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      const res = await createClassPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Klassenname ist erforderlich.');
      expect(db.class.create).not.toHaveBeenCalled();
    });

    it('akzeptiert gültige Klassennamen bis 100 Zeichen', async () => {
      const validName = '4. Primar B';
      vi.mocked(db.class.findFirst).mockResolvedValueOnce(null);
      vi.mocked(db.class.create).mockResolvedValueOnce({
        id: 'new-class',
        name: validName,
        teacherId: mockTeacherId,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as Awaited<ReturnType<typeof db.class.create>>);

      const req = new Request('http://localhost/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: validName }),
      });

      const res = await createClassPost(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(db.class.create).toHaveBeenCalledWith({
        data: { name: validName, teacherId: mockTeacherId },
      });
    });
  });

  describe('Client Header-Layout und Umbenennen-Dialog Robustheit', () => {
    it('app/classes/[id]/page.tsx bricht lange Klassennamen im Header um (wordBreak & overflowWrap)', () => {
      const fileContent = fs.readFileSync(
        path.resolve(__dirname, '../../app/classes/[id]/page.tsx'),
        'utf-8'
      );

      // Check wrapping on class name header typography
      expect(fileContent).toContain("wordBreak: 'break-word'");
      expect(fileContent).toContain("overflowWrap: 'anywhere'");

      // Check minWidth: 0 to prevent flexbox blow-out
      expect(fileContent).toContain('minWidth: 0');

      // Check that actions stack prevents shrinking so buttons stay visible and clickable
      expect(fileContent).toContain('flexShrink: 0');
    });

    it('app/classes/[id]/page.tsx validiert die Maximallänge im Umbenennen-Dialog clientseitig', () => {
      const fileContent = fs.readFileSync(
        path.resolve(__dirname, '../../app/classes/[id]/page.tsx'),
        'utf-8'
      );

      expect(fileContent).toContain(
        'Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.'
      );
      expect(fileContent).toContain('trimmed.length > 100');
    });

    it('app/classes/page.tsx validiert die Maximallänge im Erstell- und Umbenennen-Dialog clientseitig', () => {
      const fileContent = fs.readFileSync(
        path.resolve(__dirname, '../../app/classes/page.tsx'),
        'utf-8'
      );

      expect(fileContent).toContain(
        'Der Klassenname ist zu lang. Maximal 100 Zeichen sind erlaubt.'
      );
      expect(fileContent).toContain('trimmed.length > 100');
    });
  });

  describe('Schweizer Hochdeutsch (Kein "ß")', () => {
    it('enthält kein "ß" in den geänderten Dateien', () => {
      const classIdFile = fs.readFileSync(
        path.resolve(__dirname, '../../app/classes/[id]/page.tsx'),
        'utf-8'
      );
      const classesFile = fs.readFileSync(
        path.resolve(__dirname, '../../app/classes/page.tsx'),
        'utf-8'
      );
      const apiClassIdRoute = fs.readFileSync(
        path.resolve(__dirname, '../../app/api/classes/[id]/route.ts'),
        'utf-8'
      );
      const apiClassesRoute = fs.readFileSync(
        path.resolve(__dirname, '../../app/api/classes/route.ts'),
        'utf-8'
      );
      const payloadLimits = fs.readFileSync(
        path.resolve(__dirname, '../../lib/payload-limits.ts'),
        'utf-8'
      );

      expect(classIdFile).not.toContain('ß');
      expect(classesFile).not.toContain('ß');
      expect(apiClassIdRoute).not.toContain('ß');
      expect(apiClassesRoute).not.toContain('ß');
      expect(payloadLimits).not.toContain('ß');
    });
  });
});
