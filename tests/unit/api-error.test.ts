import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/lib/api-error';

describe('API Error Message Extractor (lib/api-error.ts)', () => {
  it('extrahiert Fehlertext aus JSON error Feld', async () => {
    const res = new Response(JSON.stringify({ error: 'Pruefungstitel ist erforderlich.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    const msg = await getErrorMessage(res, 'Standardfehler');
    expect(msg).toBe('Pruefungstitel ist erforderlich.');
  });

  it('extrahiert Fehlertext aus JSON message Feld falls error fehlt', async () => {
    const res = new Response(JSON.stringify({ message: 'Ungueltige Eingabe.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    const msg = await getErrorMessage(res, 'Standardfehler');
    expect(msg).toBe('Ungueltige Eingabe.');
  });

  it('liefert deutsche Meldung fuer 401 Nicht autorisiert', async () => {
    const res = new Response('Unauthorized', { status: 401 });
    const msg = await getErrorMessage(res, 'Standardfehler');
    expect(msg).toContain('Nicht autorisiert');
  });

  it('liefert deutsche Meldung fuer 403 Keine Berechtigung', async () => {
    const res = new Response('Forbidden', { status: 403 });
    const msg = await getErrorMessage(res, 'Standardfehler');
    expect(msg).toContain('Keine Berechtigung');
  });

  it('faengt HTML-Fehlerseiten (z. B. 502/500) ohne JSON-Crash ab', async () => {
    const res = new Response('<html><body>502 Bad Gateway</body></html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });

    const msg = await getErrorMessage(res, 'Fallback Fehler');
    expect(msg).toBe('Serverfehler. Bitte versuche es spaeter erneut.');
  });

  it('faellt auf fallback zurueck wenn kein JSON error vorhanden ist', async () => {
    const res = new Response(JSON.stringify({}), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    const msg = await getErrorMessage(res, 'Eigener Fallback-Fehler');
    expect(msg).toBe('Eigener Fallback-Fehler');
  });
});
