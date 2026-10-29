import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { slugify } from '@/lib/slugify';
import {
  getCachedTeacher,
  setCachedTeacher,
  getHasCheckedAuth,
  clearSessionCache,
} from '@/lib/sessionCache';

describe('Password Hashing & Timing-Safe Verification (lib/auth.ts)', () => {
  it('hashes passwords with unique random salts and verifies matching passwords', async () => {
    const hash1 = await hashPassword('Sekundarschule2026!');
    const hash2 = await hashPassword('Sekundarschule2026!');

    expect(hash1).not.toBe(hash2);
    expect(hash1).toContain(':');
    expect(await verifyPassword('Sekundarschule2026!', hash1)).toBe(true);
    expect(await verifyPassword('Sekundarschule2026!', hash2)).toBe(true);
  });

  it('rejects wrong passwords, malformed hashes, and mismatched key lengths safely', async () => {
    const validHash = await hashPassword('CorrectHorseBatteryStaple');
    expect(await verifyPassword('WrongPassword', validHash)).toBe(false);
    expect(await verifyPassword('CorrectHorseBatteryStaple', 'invalid-hash-without-colon')).toBe(
      false
    );
    expect(await verifyPassword('CorrectHorseBatteryStaple', 'abcd:1234')).toBe(false);
    expect(await verifyPassword('CorrectHorseBatteryStaple', '')).toBe(false);
  });
});

describe('German & Swiss Typographic Slugifier (lib/slugify.ts)', () => {
  it('converts German umlauts, sharp s, and French/Italian diacritics into clean slugs', () => {
    expect(slugify('')).toBe('');
    expect(slugify('Prüfung: Grö\u00dfen & Brüche (Klasse 9a)')).toBe(
      'pruefung-groessen-brueche-klasse-9a'
    );
    expect(slugify('René Zürcher — École')).toBe('rene-zuercher-ecole');
    expect(slugify('  ---Multiple   Spaces & Symbols!!!---  ')).toBe('multiple-spaces-symbols');
  });
});

describe('Client Session Cache (lib/sessionCache.ts)', () => {
  beforeEach(() => {
    // Simulate browser window object
    (globalThis as unknown as { window: Record<string, unknown> }).window = {};
    clearSessionCache();
  });

  it('stores, retrieves, and clears cached teacher session in browser context', () => {
    expect(getCachedTeacher()).toBeNull();
    expect(getHasCheckedAuth()).toBe(false);

    setCachedTeacher({ id: 't-1', name: 'Frau Meier', email: 'lehrer@schule.ch' });
    expect(getCachedTeacher()).toEqual({
      id: 't-1',
      name: 'Frau Meier',
      email: 'lehrer@schule.ch',
    });
    expect(getHasCheckedAuth()).toBe(true);

    clearSessionCache();
    expect(getCachedTeacher()).toBeNull();
    expect(getHasCheckedAuth()).toBe(false);
  });
});
