import { db } from '@/lib/db';
import { getStorageAdapter } from '@/lib/storage';
import { parseStudentExamUrls } from '@/lib/grading';

export interface StorageCleanupFailure {
  submissionId: string;
  url: string;
  error: string;
}

export class StorageCleanupError extends Error {
  public readonly failedFiles: StorageCleanupFailure[];

  constructor(message: string, failedFiles: StorageCleanupFailure[]) {
    super(message);
    this.name = 'StorageCleanupError';
    this.failedFiles = failedFiles;
  }
}

/**
 * Loescht Scan-Dateien im Storage fehlersicher fuer eine gegebene Liste von Submissions.
 *
 * Fehlersicheres Design:
 * 1. Storage-Loeschung erfolgt VOR der Loeschung des DB-Datensatzes.
 * 2. Bei Fehlern im Storage wird die DB-Loeschung abgebrochen.
 * 3. Schlaegt das Loeschen einer Datei im Storage fehl, bleibt die Referenz in der Datenbank
 *    erhalten, sodass keine Personendaten als verwaiste Dateien ohne Zuordnung zurueckbleiben.
 * 4. Erfolgreich geloeschte Dateien werden in der DB nachgefuehrt, damit bei einer Wiederholung
 *    (Retry) genau die verbleibenden Dateien nachgeholt werden.
 */
export async function deleteSubmissionScanFiles(
  submissions: Array<{ id: string; studentExamUrl: string | null }>
): Promise<{ deletedCount: number }> {
  const storage = getStorageAdapter();
  const failedFiles: StorageCleanupFailure[] = [];
  let deletedCount = 0;

  for (const sub of submissions) {
    if (!sub.studentExamUrl) continue;
    const urls = parseStudentExamUrls(sub.studentExamUrl);
    if (urls.length === 0) continue;

    const remainingUrls: string[] = [];

    for (const url of urls) {
      let deleted = false;
      let lastError: unknown = null;

      // 3 Versuche bei temporaeren Netzwerk- oder Storage-Stoerungen
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await storage.delete(url);
          deleted = true;
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (deleted) {
        deletedCount++;
      } else {
        remainingUrls.push(url);
        failedFiles.push({
          submissionId: sub.id,
          url,
          error: lastError instanceof Error ? lastError.message : String(lastError),
        });
      }
    }

    // Wenn sich die Liste der verbleibenden URLs geaendert hat, in der DB nachfuehren,
    // damit die Referenzen fuer ein spaeteres Nachholen konsistent bleiben.
    if (remainingUrls.length !== urls.length) {
      try {
        const nextUrlValue =
          remainingUrls.length === 0
            ? null
            : remainingUrls.length === 1
              ? remainingUrls[0]
              : JSON.stringify(remainingUrls);

        await db.submission.update({
          where: { id: sub.id },
          data: { studentExamUrl: nextUrlValue },
        });
      } catch (dbErr) {
        console.warn('DB-Aktualisierung der verbleibenden Scan-Dateien fehlgeschlagen:', dbErr);
      }
    }
  }

  if (failedFiles.length > 0) {
    throw new StorageCleanupError(
      `Loeschen von ${failedFiles.length} Scan-Datei(en) im Storage fehlgeschlagen.`,
      failedFiles
    );
  }

  return { deletedCount };
}

/**
 * Loescht alle zugehoerigen Scan-Dateien einer Pruefung vor der Kaskadenloeschung.
 */
export async function deleteExamScanFiles(examId: string): Promise<{ deletedCount: number }> {
  const submissions = await db.submission.findMany({
    where: { examId },
    select: { id: true, studentExamUrl: true },
  });
  return deleteSubmissionScanFiles(submissions);
}

/**
 * Loescht alle zugehoerigen Scan-Dateien einer Klasse vor der Kaskadenloeschung.
 */
export async function deleteClassScanFiles(classId: string): Promise<{ deletedCount: number }> {
  const submissions = await db.submission.findMany({
    where: {
      OR: [{ exam: { classId } }, { student: { classId } }],
    },
    select: { id: true, studentExamUrl: true },
  });
  return deleteSubmissionScanFiles(submissions);
}

/**
 * Loescht alle zugehoerigen Scan-Dateien eines Schuelers vor der Kaskadenloeschung.
 */
export async function deleteStudentScanFiles(studentId: string): Promise<{ deletedCount: number }> {
  const submissions = await db.submission.findMany({
    where: { studentId },
    select: { id: true, studentExamUrl: true },
  });
  return deleteSubmissionScanFiles(submissions);
}
