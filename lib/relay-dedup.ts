/**
 * Deduplizierungs- und Assemblierungslogik fuer Mobile-Relay-Scans.
 *
 * Stellt sicher, dass einseitige Scans nicht doppelt erfasst werden
 * (z. B. durch doppelte Change-Events des File-Pickers, doppeltes Absenden
 * oder identische Frame-Uebertragungen), waehrend mehrseitige Pruefungen
 * mit unterschiedlichen Seiten vollstaendig in der urspruenglichen Reihenfolge
 * erhalten bleiben.
 */

/**
 * Dedupliziert Datei-Listen fuer den mobilen Scan-Relay anhand von Dateimetadaten
 * (Dateiname, Dateigroesse, letztes Aenderungsdatum).
 * Behaelt alle unterschiedlichen Seiten in ihrer urspruenglichen Reihenfolge bei.
 */
export function deduplicateRelayFiles<
  T extends { name: string; size: number; lastModified?: number },
>(files: T[]): T[] {
  const seen = new Set<string>();
  const distinct: T[] = [];
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified ?? 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      distinct.push(file);
    }
  }
  return distinct;
}

/**
 * Fuegt neu erfasste Seiten zur bestehenden Aufnahmeliste hinzu, ohne Duplikate
 * mehrfach anzufuegen (z. B. durch doppelte Browser-Events oder wiederholte Auswahl).
 */
export function assembleCapturedPages<
  T extends { file: { name: string; size: number; lastModified?: number } },
>(currentPages: T[], newPages: T[]): { pages: T[]; droppedCount: number } {
  const seen = new Set<string>();
  const pages: T[] = [];

  for (const item of currentPages) {
    const key = `${item.file.name}:${item.file.size}:${item.file.lastModified ?? 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      pages.push(item);
    }
  }

  let droppedCount = 0;
  for (const item of newPages) {
    const key = `${item.file.name}:${item.file.size}:${item.file.lastModified ?? 0}`;
    if (!seen.has(key)) {
      seen.add(key);
      pages.push(item);
    } else {
      droppedCount++;
    }
  }

  return { pages, droppedCount };
}

/**
 * Dedupliziert gepufferte Bild-Payloads serverseitig anhand einer Hash-Funktion (z. B. SHA-256).
 * Verhindert, dass identische Seiten mehrfach abgespeichert oder an das LLM gesendet werden,
 * behaelt jedoch alle unterschiedlichen Seiten in exakter Reihenfolge bei.
 */
export function deduplicatePayloadsByHash<T>(items: T[], getHash: (item: T) => string): T[] {
  const seen = new Set<string>();
  const distinct: T[] = [];
  for (const item of items) {
    const hash = getHash(item);
    if (!seen.has(hash)) {
      seen.add(hash);
      distinct.push(item);
    }
  }
  return distinct;
}
