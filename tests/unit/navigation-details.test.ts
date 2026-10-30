import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('UX Navigation Details Improvements', () => {
  it('Klassenkarten verlinken den Klassennamen direkt auf die Klassendetailseite', () => {
    const classesFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/page.tsx'),
      'utf-8'
    );
    expect(classesFile).toContain('href={`/classes/${cls.id}`}');
    expect(classesFile).toContain('{cls.name}');
    // Check that Link wraps cls.name
    const linkMatch = classesFile.match(
      /<Link[\s\S]*?href=\{`\/classes\/\$\{cls\.id\}`\}[\s\S]*?>[\s\S]*?\{cls\.name\}[\s\S]*?<\/Link>/
    );
    expect(linkMatch).not.toBeNull();
  });

  it('Startseite bietet im Header direkte Einstiegspunkte für Login und Registrieren', () => {
    const landingFile = fs.readFileSync(path.resolve(__dirname, '../../app/page.tsx'), 'utf-8');
    expect(landingFile).toContain('href="/login"');
    expect(landingFile).toContain('href="/register"');
    expect(landingFile).toContain('Login');
    expect(landingFile).toContain('Registrieren');
  });

  it('Startseite bietet in der Hero-Sektion einen sichtbaren Login/Registrieren-Button', () => {
    const landingFile = fs.readFileSync(path.resolve(__dirname, '../../app/page.tsx'), 'utf-8');
    expect(landingFile).toContain('Login / Registrieren');
  });

  it('Verwendet kein "ß" in geaenderten Navigationstexten (Schweizer Rechtschreibung)', () => {
    const landingFile = fs.readFileSync(path.resolve(__dirname, '../../app/page.tsx'), 'utf-8');
    const classesFile = fs.readFileSync(
      path.resolve(__dirname, '../../app/classes/page.tsx'),
      'utf-8'
    );
    expect(landingFile).not.toContain('ß');
    expect(classesFile).not.toContain('ß');
  });
});
