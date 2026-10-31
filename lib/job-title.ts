export interface DashboardJobLike {
  studentName: string;
  examTitle: string;
  className: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
}

/**
 * Ermittelt den Anzeigetitel fuer eine Korrektur-Jobkarte im Dashboard.
 *
 * Logik:
 * - FAILED + nicht zugeordnet: "Korrektur fehlgeschlagen (<Pruefung>) (<Klasse>)"
 * - PENDING / PROCESSING + nicht zugeordnet: "🤖 Auto-Match läuft... (<Pruefung>) (<Klasse>)"
 * - COMPLETED oder andere Status / bereits zugeordnet: "<Schuelername> — <Pruefung> (<Klasse>)"
 */
export function getDashboardJobTitle(job: DashboardJobLike): string {
  const shortExamTitle = job.examTitle ? job.examTitle.split(':')[0] : '';

  if (job.studentName === 'Nicht zugeordnet') {
    if (job.status === 'FAILED') {
      return `Korrektur fehlgeschlagen (${shortExamTitle}) (${job.className})`;
    }
    if (job.status === 'PENDING' || job.status === 'PROCESSING') {
      return `🤖 Auto-Match läuft... (${shortExamTitle}) (${job.className})`;
    }
  }

  return `${job.studentName} — ${job.examTitle} (${job.className})`;
}
