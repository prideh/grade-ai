/**
 * Extrahiert eine benutzerfreundliche deutsche Fehlermeldung aus einer API-Antwort.
 * Verhindert SyntaxError bei Nicht-JSON-Antworten (z. B. 502/504 HTML-Seiten).
 */
export async function getErrorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) {
    return 'Nicht autorisiert. Bitte melde dich erneut an.';
  }
  if (res.status === 403) {
    return 'Keine Berechtigung fuer diese Aktion.';
  }
  if (res.status === 404) {
    return 'Ressource nicht gefunden.';
  }

  try {
    const data = await res.json();
    if (data && typeof data.error === 'string' && data.error.trim()) {
      return data.error.trim();
    }
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }
  } catch {
    // Antwort war kein valides JSON
  }

  if (res.status >= 500) {
    return 'Serverfehler. Bitte versuche es spaeter erneut.';
  }

  return fallback;
}
