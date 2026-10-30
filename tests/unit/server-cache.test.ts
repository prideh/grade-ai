import { describe, it, expect, beforeEach } from 'vitest';
import {
  serverCache,
  CacheTags,
  invalidateClassCache,
  invalidateStudentCache,
  invalidateExamCache,
  invalidateSubmissionCache,
  invalidateLogsCache,
} from '@/lib/cache';
import fs from 'fs';
import path from 'path';

describe('Server-Side Response Cache (lib/cache.ts)', () => {
  beforeEach(async () => {
    await serverCache.clear();
  });

  describe('Core Cache Operations', () => {
    it('speichert und liefert gecachte Werte korrekt zurueck', async () => {
      const key = 'teacher:t1:classes:list';
      const data = { classes: [{ id: 'c1', name: 'Klasse 3a' }] };

      await serverCache.set(key, data);
      const cached = await serverCache.get<typeof data>(key);

      expect(cached).toEqual(data);
    });

    it('liefert null fuer nicht existierende Keys', async () => {
      const cached = await serverCache.get('teacher:t1:nonexistent');
      expect(cached).toBeNull();
    });

    it('loescht Eintraege mit delete()', async () => {
      const key = 'teacher:t1:test';
      await serverCache.set(key, { value: 123 });
      expect(await serverCache.get(key)).toEqual({ value: 123 });

      await serverCache.delete(key);
      expect(await serverCache.get(key)).toBeNull();
    });

    it('respektiert die TTL als Sicherheitsnetz und laeuft nach Ablauf ab', async () => {
      const key = 'teacher:t1:short-ttl';
      await serverCache.set(key, { greeting: 'hallo' }, { ttlMs: 50 });

      // Immediate read
      expect(await serverCache.get(key)).toEqual({ greeting: 'hallo' });

      // Wait past TTL
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(await serverCache.get(key)).toBeNull();
    });

    it('tracked Cache-Groesse korrekt und leert mit clear()', async () => {
      expect(await serverCache.size()).toBe(0);

      await serverCache.set('k1', 'v1');
      await serverCache.set('k2', 'v2');
      expect(await serverCache.size()).toBe(2);

      await serverCache.clear();
      expect(await serverCache.size()).toBe(0);
    });
  });

  describe('Tenant Isolation (Mandantentrennung)', () => {
    it('isoliert Daten zwischen zwei Lehrpersonen vollstaendig auf derselben Route', async () => {
      const teacherA = 'teacher-alpha';
      const teacherB = 'teacher-beta';

      const keyA = `teacher:${teacherA}:classes:list`;
      const keyB = `teacher:${teacherB}:classes:list`;

      const classesA = { classes: [{ id: 'cA', name: 'Sekundarstufe A' }] };
      const classesB = { classes: [{ id: 'cB', name: 'Sekundarstufe B' }] };

      await serverCache.set(keyA, classesA, {
        tags: [CacheTags.teacher(teacherA), CacheTags.classes(teacherA)],
      });
      await serverCache.set(keyB, classesB, {
        tags: [CacheTags.teacher(teacherB), CacheTags.classes(teacherB)],
      });

      // Teacher A gets only Teacher A's classes
      const cachedA = await serverCache.get<typeof classesA>(keyA);
      expect(cachedA).toEqual(classesA);
      expect(cachedA?.classes[0].name).toBe('Sekundarstufe A');

      // Teacher B gets only Teacher B's classes
      const cachedB = await serverCache.get<typeof classesB>(keyB);
      expect(cachedB).toEqual(classesB);
      expect(cachedB?.classes[0].name).toBe('Sekundarstufe B');
    });

    it('stellt sicher, dass eine Invalidierung bei Lehrer A die Caches von Lehrer B nicht beeintraechtigt', async () => {
      const teacherA = 'teacher-alpha';
      const teacherB = 'teacher-beta';

      const keyA = `teacher:${teacherA}:classes:list`;
      const keyB = `teacher:${teacherB}:classes:list`;

      await serverCache.set(
        keyA,
        { classes: ['A'] },
        {
          tags: [CacheTags.teacher(teacherA), CacheTags.classes(teacherA)],
        }
      );
      await serverCache.set(
        keyB,
        { classes: ['B'] },
        {
          tags: [CacheTags.teacher(teacherB), CacheTags.classes(teacherB)],
        }
      );

      // Invalidate teacher A
      await invalidateClassCache(teacherA);

      // Teacher A is cleared
      expect(await serverCache.get(keyA)).toBeNull();

      // Teacher B remains completely untouched in cache
      expect(await serverCache.get(keyB)).toEqual({ classes: ['B'] });
    });
  });

  describe('Stale-Read Regression & Explicit Write Invalidation', () => {
    it('Klassen-Mutation invalidiert Klassenliste und Klassendetails sofort', async () => {
      const teacherId = 'teacher-101';
      const classId = 'class-202';

      const listKey = `teacher:${teacherId}:classes:list`;
      const detailKey = `teacher:${teacherId}:class:${classId}:detail`;

      await serverCache.set(
        listKey,
        { classes: [{ id: classId, name: 'Alt' }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.classes(teacherId)],
        }
      );
      await serverCache.set(
        detailKey,
        { class: { id: classId, name: 'Alt' } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.class(teacherId, classId)],
        }
      );

      expect(await serverCache.get(listKey)).not.toBeNull();
      expect(await serverCache.get(detailKey)).not.toBeNull();

      // Simuliere Mutation (z.B. PUT /api/classes/[id])
      await invalidateClassCache(teacherId, classId);

      // Sofortiger naechster Lesezugriff muss Cache-Miss sein (stale-read verhindert)
      expect(await serverCache.get(listKey)).toBeNull();
      expect(await serverCache.get(detailKey)).toBeNull();
    });

    it('Schueler-Mutation invalidiert Schuelerdetails, Klassenroster und Pruefungsroster', async () => {
      const teacherId = 'teacher-101';
      const classId = 'class-202';
      const studentId = 'student-303';

      const studentDetailKey = `teacher:${teacherId}:student:${studentId}:detail`;
      const classStudentsKey = `teacher:${teacherId}:class:${classId}:students`;
      const classDetailKey = `teacher:${teacherId}:class:${classId}:detail`;
      const examsListKey = `teacher:${teacherId}:exams:list`;

      await serverCache.set(
        studentDetailKey,
        { student: { id: studentId, name: 'Max' } },
        {
          tags: [
            CacheTags.teacher(teacherId),
            CacheTags.student(teacherId, studentId),
            CacheTags.class(teacherId, classId),
          ],
        }
      );
      await serverCache.set(
        classStudentsKey,
        { students: [{ id: studentId, name: 'Max' }] },
        {
          tags: [
            CacheTags.teacher(teacherId),
            CacheTags.class(teacherId, classId),
            CacheTags.students(teacherId),
          ],
        }
      );
      await serverCache.set(
        classDetailKey,
        { class: { id: classId } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.class(teacherId, classId)],
        }
      );
      await serverCache.set(
        examsListKey,
        { exams: [] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exams(teacherId)],
        }
      );

      // Simuliere Schueler-Update
      await invalidateStudentCache(teacherId, studentId, classId);

      expect(await serverCache.get(studentDetailKey)).toBeNull();
      expect(await serverCache.get(classStudentsKey)).toBeNull();
      expect(await serverCache.get(classDetailKey)).toBeNull();
      expect(await serverCache.get(examsListKey)).toBeNull();
    });

    it('Pruefungs-Mutation invalidiert Pruefungsliste, Details, Feedback-Sheets und Aufgabenanalyse', async () => {
      const teacherId = 'teacher-101';
      const classId = 'class-202';
      const examId = 'exam-404';

      const examListKey = `teacher:${teacherId}:exams:list`;
      const examDetailKey = `teacher:${teacherId}:exam:${examId}:detail`;
      const taskAnalysisKey = `teacher:${teacherId}:exam:${examId}:task-analysis`;
      const feedbackSheetsKey = `teacher:${teacherId}:exam:${examId}:feedback-sheets`;

      await serverCache.set(
        examListKey,
        { exams: [{ id: examId }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exams(teacherId)],
        }
      );
      await serverCache.set(
        examDetailKey,
        { exam: { id: examId } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );
      await serverCache.set(
        taskAnalysisKey,
        { success: true, taskAnalysis: [] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );
      await serverCache.set(
        feedbackSheetsKey,
        { sheets: [] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );

      // Simuliere Pruefungsaktualisierung
      await invalidateExamCache(teacherId, examId, classId);

      expect(await serverCache.get(examListKey)).toBeNull();
      expect(await serverCache.get(examDetailKey)).toBeNull();
      expect(await serverCache.get(taskAnalysisKey)).toBeNull();
      expect(await serverCache.get(feedbackSheetsKey)).toBeNull();
    });

    it('Neue Abgabe / Korrektur invalidiert vollstaendig: Pruefungsstatistik UND Klassenaggregate UND Notentrajektorien', async () => {
      const teacherId = 'teacher-101';
      const classId = 'class-202';
      const examId = 'exam-404';
      const studentId = 'student-303';
      const submissionId = 'sub-505';

      // 1. Klassen-Aggregate
      const classesListKey = `teacher:${teacherId}:classes:list`;
      const classDetailKey = `teacher:${teacherId}:class:${classId}:detail`;

      // 2. Pruefungs-Statistik
      const examsListKey = `teacher:${teacherId}:exams:list`;
      const examDetailKey = `teacher:${teacherId}:exam:${examId}:detail`;
      const taskAnalysisKey = `teacher:${teacherId}:exam:${examId}:task-analysis`;
      const feedbackSheetsKey = `teacher:${teacherId}:exam:${examId}:feedback-sheets`;

      // 3. Schueler-Trajektorie
      const studentDetailKey = `teacher:${teacherId}:student:${studentId}:detail`;

      // 4. Abgabenliste und Detail
      const submissionsListKey = `teacher:${teacherId}:submissions:list`;
      const submissionDetailKey = `teacher:${teacherId}:submission:${submissionId}:detail`;

      await serverCache.set(
        classesListKey,
        { classes: [{ averageGrade: '4.50' }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.classes(teacherId)],
        }
      );
      await serverCache.set(
        classDetailKey,
        { stats: { averageGrade: '4.50' } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.class(teacherId, classId)],
        }
      );
      await serverCache.set(
        examsListKey,
        { exams: [{ averageGrade: '4.50' }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exams(teacherId)],
        }
      );
      await serverCache.set(
        examDetailKey,
        { stats: { averageGrade: '4.50' } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );
      await serverCache.set(
        taskAnalysisKey,
        { taskAnalysis: [{ aufgabe: 1, schnitt: 3.5 }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );
      await serverCache.set(
        feedbackSheetsKey,
        { sheets: [] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.exam(teacherId, examId)],
        }
      );
      await serverCache.set(
        studentDetailKey,
        { stats: { averageGrade: '4.50' } },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.student(teacherId, studentId)],
        }
      );
      await serverCache.set(
        submissionsListKey,
        { submissions: [{ id: submissionId }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.submissions(teacherId)],
        }
      );
      await serverCache.set(
        submissionDetailKey,
        { id: submissionId, grade: '4.5' },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.submission(teacherId, submissionId)],
        }
      );

      // Alle 9 Ressourcen sind gecacht
      expect(await serverCache.get(classesListKey)).not.toBeNull();
      expect(await serverCache.get(classDetailKey)).not.toBeNull();
      expect(await serverCache.get(examsListKey)).not.toBeNull();
      expect(await serverCache.get(examDetailKey)).not.toBeNull();
      expect(await serverCache.get(taskAnalysisKey)).not.toBeNull();
      expect(await serverCache.get(feedbackSheetsKey)).not.toBeNull();
      expect(await serverCache.get(studentDetailKey)).not.toBeNull();
      expect(await serverCache.get(submissionsListKey)).not.toBeNull();
      expect(await serverCache.get(submissionDetailKey)).not.toBeNull();

      // Trigger Submission-Invalidierung
      await invalidateSubmissionCache(teacherId, {
        submissionId,
        examId,
        classId,
        studentId,
      });

      // ALLES muss sofort invalidiert sein!
      expect(await serverCache.get(classesListKey)).toBeNull();
      expect(await serverCache.get(classDetailKey)).toBeNull();
      expect(await serverCache.get(examsListKey)).toBeNull();
      expect(await serverCache.get(examDetailKey)).toBeNull();
      expect(await serverCache.get(taskAnalysisKey)).toBeNull();
      expect(await serverCache.get(feedbackSheetsKey)).toBeNull();
      expect(await serverCache.get(studentDetailKey)).toBeNull();
      expect(await serverCache.get(submissionsListKey)).toBeNull();
      expect(await serverCache.get(submissionDetailKey)).toBeNull();
    });

    it('Korrektur-Protokoll (logs) wird bei Invalidierung geleert', async () => {
      const teacherId = 'teacher-101';
      const logsKey = `teacher:${teacherId}:logs:list`;

      await serverCache.set(
        logsKey,
        { logs: [{ id: 'l1' }] },
        {
          tags: [CacheTags.teacher(teacherId), CacheTags.logs(teacherId)],
        }
      );
      expect(await serverCache.get(logsKey)).not.toBeNull();

      await invalidateLogsCache(teacherId);
      expect(await serverCache.get(logsKey)).toBeNull();
    });
  });

  describe('Swiss German Spelling & Code Integrity', () => {
    it('Enthaelt kein Eszett in lib/cache.ts', () => {
      const cacheSource = fs.readFileSync(path.resolve(__dirname, '../../lib/cache.ts'), 'utf-8');
      expect(cacheSource).not.toContain('\u00DF');
    });

    it('Enthaelt kein Eszett in den modifizierten API-Routen', () => {
      const routePaths = [
        '../../app/api/classes/route.ts',
        '../../app/api/classes/[id]/route.ts',
        '../../app/api/classes/[id]/students/route.ts',
        '../../app/api/classes/[id]/exams/route.ts',
        '../../app/api/students/[id]/route.ts',
        '../../app/api/exams/route.ts',
        '../../app/api/exams/[id]/route.ts',
        '../../app/api/exams/[id]/task-analysis/route.ts',
        '../../app/api/exams/[id]/feedback-sheets/route.ts',
        '../../app/api/exams/[id]/duplicate/route.ts',
        '../../app/api/submissions/route.ts',
        '../../app/api/submissions/[id]/route.ts',
        '../../app/api/submissions/[id]/add-task/route.ts',
        '../../app/api/submissions/[id]/replace/route.ts',
        '../../app/api/correct/route.ts',
        '../../app/api/logs/route.ts',
      ];

      for (const rel of routePaths) {
        const content = fs.readFileSync(path.resolve(__dirname, rel), 'utf-8');
        expect(content).not.toContain('\u00DF');
      }
    });
  });
});
