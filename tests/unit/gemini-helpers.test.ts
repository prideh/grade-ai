import { describe, it, expect } from 'vitest';
import { appendReferenceMaterialToContents } from '@/lib/gemini';

describe('Multimodal Reference Material Parser (lib/gemini.ts)', () => {
  it('appends plain text rubrics directly as string content', () => {
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];
    appendReferenceMaterialToContents(contents, 'Aufgabe 1: x = 5 (3 Punkte)');
    expect(contents).toEqual(['Aufgabe 1: x = 5 (3 Punkte)']);
  });

  it('parses single-page JSON inlineData strings into multimodal parts', () => {
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];
    appendReferenceMaterialToContents(
      contents,
      JSON.stringify({ mimeType: 'image/jpeg', data: 'BASE64_PAGE_1' })
    );
    expect(contents).toEqual([{ inlineData: { mimeType: 'image/jpeg', data: 'BASE64_PAGE_1' } }]);
  });

  it('parses multi-page JSON array inlineData strings with page headers', () => {
    const contents: (string | { inlineData: { mimeType: string; data: string } })[] = [];
    appendReferenceMaterialToContents(
      contents,
      JSON.stringify([
        { mimeType: 'image/jpeg', data: 'PAGE_1_DATA' },
        { mimeType: 'image/png', data: 'PAGE_2_DATA' },
      ])
    );
    expect(contents).toEqual([
      '--- Referenzdokument Seite 1 ---',
      { inlineData: { mimeType: 'image/jpeg', data: 'PAGE_1_DATA' } },
      '--- Referenzdokument Seite 2 ---',
      { inlineData: { mimeType: 'image/png', data: 'PAGE_2_DATA' } },
    ]);
  });
});
