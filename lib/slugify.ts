/**
 * Sanitizes a string and converts it to a URL-friendly, SEO-safe slug.
 * Specially optimized for German language apps by mapping German umlauts (ä, ö, ü)
 * and eszett (ß) to their standard standard typographic representations (ae, oe, ue, ss).
 *
 * It also normalizes other unicode accents/diacritics (e.g., é -> e, ç -> c)
 * and strips out any remaining non-alphanumeric characters.
 *
 * @param text The input string to slugify (e.g. "Unbekannter Schüler! %20")
 * @returns The clean, URL-safe slug (e.g. "unbekannter-schueler")
 */
export function slugify(text: string): string {
  if (!text) return '';

  return (
    text
      .toLowerCase()
      // 1. Convert German umlauts and eszett
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      // 2. Normalize and strip other diacritics/accents (e.g. é -> e, ô -> o)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // 3. Replace non-alphanumeric characters with hyphens
      .replace(/[^a-z0-9]+/g, '-')
      // 4. Clean leading/trailing hyphens and reduce duplicate hyphens
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
  );
}
