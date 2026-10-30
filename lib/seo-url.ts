/**
 * Ermittelt die Basis-URL fuer SEO-Metadaten, Robots und Sitemap.
 * Beruecksichtigt Umgebungsvariablen und faengt ungueltige Werte (z. B. BASE_URL="/" in Testumgebungen) sicher ab.
 */
export function getBaseUrl(): string {
  const envUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.BASE_URL && process.env.BASE_URL !== '/' ? process.env.BASE_URL : undefined) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    'https://grade-ai.ch';

  const normalized =
    envUrl.startsWith('http://') || envUrl.startsWith('https://') ? envUrl : `https://${envUrl}`;

  try {
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return 'https://grade-ai.ch';
  }
}
