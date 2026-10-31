import { describe, it, expect } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import manifest from '@/app/manifest';
import { metadata as rootMetadata } from '@/app/layout';
import { metadata as homeMetadata } from '@/app/page';
import { metadata as dashboardMeta } from '@/app/dashboard/layout';
import { metadata as classesMeta } from '@/app/classes/layout';
import { metadata as examsMeta } from '@/app/exams/layout';
import { metadata as submissionsMeta } from '@/app/submissions/layout';
import { metadata as correctMeta } from '@/app/correct/layout';
import { metadata as logsMeta } from '@/app/logs/layout';
import { metadata as studentsMeta } from '@/app/students/layout';
import { metadata as scanMeta } from '@/app/scan/layout';
import { metadata as loginMeta } from '@/app/login/layout';
import { metadata as registerMeta } from '@/app/register/layout';
import * as fs from 'fs';
import * as path from 'path';

describe('SEO Metadata, Robots, Sitemap & Icons (Issue #17)', () => {
  it('app/robots.ts erlaubt die Landing-Page und sperrt geschuetzte & Token-Routen aus', () => {
    const robotsData = robots();
    const rules = Array.isArray(robotsData.rules) ? robotsData.rules[0] : robotsData.rules;

    expect(rules.allow).toContain('/$');

    const disallows = Array.isArray(rules.disallow) ? rules.disallow : [rules.disallow];
    expect(disallows).toEqual(
      expect.arrayContaining([
        '/dashboard/',
        '/classes/',
        '/exams/',
        '/submissions/',
        '/correct/',
        '/logs/',
        '/students/',
        '/scan/',
        '/login/',
        '/register/',
        '/api/',
      ])
    );
    expect(robotsData.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it('app/sitemap.ts fuehrt ausschliesslich die oeffentliche Landing-Page auf', () => {
    const sitemapData = sitemap();
    expect(sitemapData).toHaveLength(1);
    expect(sitemapData[0].url).toMatch(/^https?:\/\/.+\/$/);
    expect(sitemapData[0].priority).toBe(1.0);
    expect(sitemapData[0].changeFrequency).toBe('weekly');
  });

  it('app/manifest.ts liefert ein vollstaendiges Web-App-Manifest mit Icons', () => {
    const manifestData = manifest();
    expect(manifestData.name).toContain('prüefli');
    expect(manifestData.start_url).toBe('/');
    expect(manifestData.display).toBe('standalone');
    expect(manifestData.icons?.length).toBeGreaterThan(0);
  });

  it('app/layout.tsx definiert metadataBase, Favicon & App-Icons', () => {
    expect(rootMetadata.metadataBase).toBeDefined();
    expect(rootMetadata.icons).toBeDefined();
    expect(rootMetadata.manifest).toBe('/manifest.webmanifest');
  });

  it('Landing-Page app/page.tsx definiert vollstaendige OpenGraph-, Twitter- und kanonische Metadaten', () => {
    expect(homeMetadata.title).toBeDefined();
    expect(homeMetadata.description).toBeDefined();
    expect(homeMetadata.alternates?.canonical).toBe('/');

    const og = homeMetadata.openGraph as Record<string, unknown>;
    expect(og).toBeDefined();
    expect(og.title).toContain('prüefli');
    expect(og.type).toBe('website');
    expect(og.locale).toBe('de_CH');
    expect(Array.isArray(og.images)).toBe(true);

    const twitter = homeMetadata.twitter as Record<string, unknown>;
    expect(twitter).toBeDefined();
    expect(twitter.card).toBe('summary_large_image');
    expect(twitter.images).toBeDefined();

    expect(homeMetadata.robots).toEqual({ index: true, follow: true });
  });

  it('alle internen App-Routen tragen explizit noindex & nofollow', () => {
    const noIndexMetas = [
      dashboardMeta,
      classesMeta,
      examsMeta,
      submissionsMeta,
      correctMeta,
      logsMeta,
      studentsMeta,
      scanMeta,
      loginMeta,
      registerMeta,
    ];

    for (const meta of noIndexMetas) {
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });

  it('alle statischen Asset-Dateien (OG-Image, Favicon, SVG-Icon) existieren auf der Festplatte', () => {
    const ogImagePath = path.join(process.cwd(), 'public/og-image.png');
    const faviconPath = path.join(process.cwd(), 'public/favicon.ico');
    const iconSvgApp = path.join(process.cwd(), 'app/icon.svg');
    const iconSvgPublic = path.join(process.cwd(), 'public/icon.svg');

    expect(fs.existsSync(ogImagePath)).toBe(true);
    expect(fs.statSync(ogImagePath).size).toBeGreaterThan(1000);

    expect(fs.existsSync(faviconPath)).toBe(true);
    expect(fs.statSync(faviconPath).size).toBeGreaterThan(100);

    expect(fs.existsSync(iconSvgApp)).toBe(true);
    expect(fs.existsSync(iconSvgPublic)).toBe(true);
  });

  it('haelt Schweizer Rechtschreibung ein (kein "ß")', () => {
    const filesToCheck = [
      'app/robots.ts',
      'app/sitemap.ts',
      'app/manifest.ts',
      'app/layout.tsx',
      'app/page.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      expect(content).not.toContain('ß');
    }
  });
});
