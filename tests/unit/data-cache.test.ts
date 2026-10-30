import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getCachedData,
  setCachedData,
  removeCachedData,
  clearDataCache,
  fetchWithCache,
  mutateCache,
  invalidateCache,
  invalidateClasses,
  invalidateExams,
  invalidateSubmissions,
  invalidateStudents,
  invalidateLogs,
  subscribeToCacheKey,
} from '@/lib/dataCache';
import { clearSessionCache } from '@/lib/sessionCache';

describe('Client-Side Data Cache & Invalidation (lib/dataCache.ts)', () => {
  beforeEach(() => {
    clearDataCache();
    vi.restoreAllMocks();
  });

  describe('Scope 1 & 2: Cache retrieval, instant navigation & request deduplication', () => {
    it('liefert gecachte Daten sofort synchron zurück', () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Klasse 3a' }]);
      const cached = getCachedData<Array<{ id: string; name: string }>>('/api/classes');
      expect(cached).toEqual([{ id: 'c1', name: 'Klasse 3a' }]);
    });

    it('entfernt einzelne gecachte Schlüssel mit removeCachedData', () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Klasse 3a' }]);
      expect(getCachedData('/api/classes')).toBeDefined();

      removeCachedData('/api/classes');
      expect(getCachedData('/api/classes')).toBeUndefined();
    });

    it('dedupliziert parallele Anfragen auf denselben Endpunkt', async () => {
      let callCount = 0;
      const mockFetcher = vi.fn().mockImplementation(async () => {
        callCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { data: 'ok', count: callCount };
      });

      // Zwei gleichzeitige Aufrufe
      const [res1, res2] = await Promise.all([
        fetchWithCache('/api/classes', mockFetcher),
        fetchWithCache('/api/classes', mockFetcher),
      ]);

      expect(callCount).toBe(1);
      expect(res1).toEqual({ data: 'ok', count: 1 });
      expect(res2).toEqual({ data: 'ok', count: 1 });
    });

    it('aktualisiert den Cache bei erfolgreicher Hintergrund-Revalidierung', async () => {
      setCachedData('/api/exams', [{ id: 'e1', title: 'Mathe 1' }]);

      const mockFetcher = vi.fn().mockResolvedValue([
        { id: 'e1', title: 'Mathe 1' },
        { id: 'e2', title: 'Mathe 2' },
      ]);

      const freshData = await fetchWithCache('/api/exams', mockFetcher);
      expect(freshData).toHaveLength(2);
      expect(getCachedData('/api/exams')).toEqual(freshData);
    });
  });

  describe('Scope 3: Mutation Invalidation & Cross-Page Effects', () => {
    it('invalidateClasses invalidiert Klassenlisten und spezifische Klassendetails', () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Klasse 1' }]);
      setCachedData('/api/classes/c1', { id: 'c1', name: 'Klasse 1', students: [] });
      setCachedData('/api/exams', [{ id: 'e1' }]);

      invalidateClasses('c1');

      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(getCachedData('/api/classes/c1')).toBeUndefined();
      // Unbeteiligte Prüfungen bleiben erhalten
      expect(getCachedData('/api/exams')).toBeDefined();
    });

    it('invalidateExams invalidiert Prüfungen UND Klassenaggregate (Cross-Page Effect)', () => {
      setCachedData('/api/exams', [{ id: 'e1' }]);
      setCachedData('/api/exams/e1', { id: 'e1', title: 'Geometrie' });
      setCachedData('/api/classes', [{ id: 'c1', totalExams: 1 }]);
      setCachedData('/api/classes/c1', { id: 'c1', totalExams: 1 });

      invalidateExams('e1', 'c1');

      expect(getCachedData('/api/exams')).toBeUndefined();
      expect(getCachedData('/api/exams/e1')).toBeUndefined();
      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(getCachedData('/api/classes/c1')).toBeUndefined();
    });

    it('invalidateStudents invalidiert Schüler und zugehörige Klassenlisten', () => {
      setCachedData('/api/students/st1', { id: 'st1', name: 'Anna' });
      setCachedData('/api/classes/c1', { id: 'c1', name: 'Klasse 1' });

      invalidateStudents('st1', 'c1');

      expect(getCachedData('/api/students/st1')).toBeUndefined();
      expect(getCachedData('/api/classes/c1')).toBeUndefined();
    });

    it('invalidateLogs invalidiert Protokolleinträge', () => {
      setCachedData('/api/logs', [{ id: 'l1', status: 'COMPLETED' }]);
      invalidateLogs();
      expect(getCachedData('/api/logs')).toBeUndefined();
    });

    it('invalidateSubmissions invalidiert Einreichungen, Prüfungen, Klassen, Noten und Protokolle', () => {
      setCachedData('/api/submissions', [{ id: 's1', status: 'COMPLETED' }]);
      setCachedData('/api/submissions/s1', { id: 's1', grade: '5.5' });
      setCachedData('/api/exams', [{ id: 'e1', averageGrade: '5.5' }]);
      setCachedData('/api/exams/e1', { id: 'e1', averageGrade: '5.5' });
      setCachedData('/api/classes', [{ id: 'c1', averageGrade: '5.5' }]);
      setCachedData('/api/classes/c1', { id: 'c1', averageGrade: '5.5' });
      setCachedData('/api/students/st1', { id: 'st1', averageGrade: '5.5' });
      setCachedData('/api/logs', [{ id: 'log1' }]);

      // Neue Einreichung verändert Prüfungs- und Klassenschnitt
      invalidateSubmissions('s1', 'e1', 'c1', 'st1');

      expect(getCachedData('/api/submissions')).toBeUndefined();
      expect(getCachedData('/api/submissions/s1')).toBeUndefined();
      expect(getCachedData('/api/exams')).toBeUndefined();
      expect(getCachedData('/api/exams/e1')).toBeUndefined();
      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(getCachedData('/api/classes/c1')).toBeUndefined();
      expect(getCachedData('/api/students/st1')).toBeUndefined();
      expect(getCachedData('/api/logs')).toBeUndefined();
    });

    it('mutateCache aktualisiert Daten sofort im Cache', async () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Alte Klasse' }]);

      await mutateCache(
        '/api/classes',
        [{ id: 'c1', name: 'Neue Klasse' }],
        false // ohne automatisches Revalidieren
      );

      expect(getCachedData('/api/classes')).toEqual([{ id: 'c1', name: 'Neue Klasse' }]);
    });

    it('benachrichtigt Subscriber bei Invalidation', () => {
      const listener = vi.fn();
      const unsubscribe = subscribeToCacheKey('/api/classes', listener);

      setCachedData('/api/classes', [{ id: 'c1' }]);
      expect(listener).toHaveBeenCalled();

      invalidateCache('/api/classes');
      expect(listener).toHaveBeenCalledTimes(2);

      unsubscribe();
    });
  });

  describe('Scope 4: Fehlerbehandlung & keine stillschweigend veralteten Daten', () => {
    it('löscht gecachte Daten bei Fehlschlag und informiert über den deutschen Fehler', async () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Klasse 1' }]);

      const listener = vi.fn();
      subscribeToCacheKey('/api/classes', listener);

      const failingFetcher = vi.fn().mockRejectedValue(new Error('Fehler beim Laden der Klassen.'));

      await expect(fetchWithCache('/api/classes', failingFetcher)).rejects.toThrow(
        'Fehler beim Laden der Klassen.'
      );

      // Der Cache darf nicht stillschweigend alte Daten als frisch präsentieren
      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(listener).toHaveBeenCalled();
    });

    it('erholt sich nach einem Fehlschlag bei erneutem erfolgreichem Laden', async () => {
      const failingFetcher = vi.fn().mockRejectedValueOnce(new Error('Netzwerkfehler'));
      await expect(fetchWithCache('/api/exams', failingFetcher)).rejects.toThrow('Netzwerkfehler');

      const successFetcher = vi.fn().mockResolvedValue([{ id: 'e1', title: 'Mathe' }]);
      const result = await fetchWithCache('/api/exams', successFetcher);

      expect(result).toEqual([{ id: 'e1', title: 'Mathe' }]);
      expect(getCachedData('/api/exams')).toEqual([{ id: 'e1', title: 'Mathe' }]);
    });
  });

  describe('Scope 5: Tenant Safety & Bereinigung bei Logout', () => {
    it('löscht sämtliche gecachten Daten und inflight-Anfragen bei clearDataCache', () => {
      setCachedData('/api/classes', [{ id: 'c1' }]);
      setCachedData('/api/exams', [{ id: 'e1' }]);
      setCachedData('/api/submissions', [{ id: 's1' }]);

      clearDataCache();

      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(getCachedData('/api/exams')).toBeUndefined();
      expect(getCachedData('/api/submissions')).toBeUndefined();
    });

    it('clearSessionCache ruft clearDataCache auf und räumt Lehrer- und Datencache auf', () => {
      setCachedData('/api/classes', [{ id: 'c1', name: 'Geheime Klasse' }]);
      setCachedData('/api/submissions', [{ id: 's1', studentName: 'Max' }]);

      clearSessionCache();

      expect(getCachedData('/api/classes')).toBeUndefined();
      expect(getCachedData('/api/submissions')).toBeUndefined();
    });
  });

  describe('Schweizer Rechtschreibung (Kein Eszett)', () => {
    it('stellt sicher, dass kein Eszett im Modul und den Fehlermeldungen verwendet wird', () => {
      const cacheSource = fs.readFileSync(
        path.resolve(__dirname, '../../lib/dataCache.ts'),
        'utf-8'
      );
      expect(cacheSource).not.toContain('\u00DF');
    });
  });
});
