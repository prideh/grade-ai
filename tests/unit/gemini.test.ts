import { describe, it, expect } from 'vitest';
import { GEMINI_CLIENT_TIMEOUT_MS, categorizeGeminiError } from '@/lib/gemini';

describe('Gemini Timeout & Error Categorization (lib/gemini.ts)', () => {
  it('defines a client timeout of 90 seconds (90000ms) to prevent 300s undici hangs', () => {
    expect(GEMINI_CLIENT_TIMEOUT_MS).toBe(90_000);
  });

  it('categorizes HeadersTimeoutError (UND_ERR_HEADERS_TIMEOUT) as TIMEOUT', () => {
    const cause = new Error('Headers Timeout Error');
    cause.name = 'HeadersTimeoutError';
    (cause as Record<string, unknown>).code = 'UND_ERR_HEADERS_TIMEOUT';

    const err = new TypeError('fetch failed');
    (err as Record<string, unknown>).cause = cause;

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('TIMEOUT');
    expect(result.userMessage).toContain('Zeitüberschreitung');
    expect(result.userMessage).toContain('90 Sekunden');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes AbortError from client-side timeout signal as TIMEOUT', () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'AbortError';

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('TIMEOUT');
    expect(result.userMessage).toContain('Zeitüberschreitung');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes APIConnectionTimeoutError as TIMEOUT', () => {
    const err = new Error('Request timed out. This is a client-side timeout.');
    err.name = 'APIConnectionTimeoutError';

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('TIMEOUT');
    expect(result.userMessage).toContain('Zeitüberschreitung');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes rate limit (429 / quota exceeded) as RATE_LIMIT', () => {
    const err = new Error('Resource has been exhausted (e.g. check quota). [429]');
    err.name = 'RateLimitError';

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('RATE_LIMIT');
    expect(result.userMessage).toContain('Anfragelimit');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes 500/503 upstream server errors as UPSTREAM_SERVICE', () => {
    const err = new Error(
      'Internal Server Error 503: The model is overloaded. Please try again later.'
    );
    err.name = 'InternalServerError';

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('UPSTREAM_SERVICE');
    expect(result.userMessage).toContain('überlastet');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes network disconnect (ECONNRESET / ENOTFOUND) as NETWORK', () => {
    const cause = new Error('read ECONNRESET');
    (cause as Record<string, unknown>).code = 'ECONNRESET';

    const err = new TypeError('fetch failed');
    (err as Record<string, unknown>).cause = cause;

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('NETWORK');
    expect(result.userMessage).toContain('Netzwerkverbindung');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes invalid/empty JSON response as INVALID_RESPONSE', () => {
    const err = new SyntaxError('Unexpected end of JSON input');

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('INVALID_RESPONSE');
    expect(result.userMessage).toContain('ungültig');
    expect(result.userMessage).not.toContain('ß');
  });

  it('categorizes generic unknown errors as UNKNOWN with Swiss German message', () => {
    const err = new Error('Something completely unexpected occurred');

    const result = categorizeGeminiError(err);
    expect(result.category).toBe('UNKNOWN');
    expect(result.userMessage).toContain('unerwarteter Fehler');
    expect(result.userMessage).not.toContain('ß');
  });
});
