import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  deduplicateRelayFiles,
  assembleCapturedPages,
  deduplicatePayloadsByHash,
} from '@/lib/relay-dedup';

describe('Mobile Relay Scan Deduplication and Assembly (lib/relay-dedup.ts)', () => {
  describe('deduplicateRelayFiles', () => {
    it('behaelt einen einzelnen 1-seitigen Scan als genau 1 Seite', () => {
      const file = { name: 'scan_p1.png', size: 1024, lastModified: 1700000000000 };
      const result = deduplicateRelayFiles([file]);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('scan_p1.png');
    });

    it('dedupliziert 2 identische Scaneintraege desselben Uploads zu genau 1 Seite', () => {
      const file1 = { name: 'scan_anna.png', size: 2048, lastModified: 1700000000000 };
      const file2 = { name: 'scan_anna.png', size: 2048, lastModified: 1700000000000 };

      const result = deduplicateRelayFiles([file1, file2]);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(file1);
    });

    it('behaelt bei mehrseitigen Pruefungen alle unterschiedlichen Seiten in urspruenglicher Reihenfolge', () => {
      const page1 = { name: 'page_1.jpg', size: 1200, lastModified: 1700000001000 };
      const page2 = { name: 'page_2.jpg', size: 1350, lastModified: 1700000002000 };
      const page3 = { name: 'page_3.jpg', size: 1100, lastModified: 1700000003000 };

      const result = deduplicateRelayFiles([page1, page2, page3]);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('page_1.jpg');
      expect(result[1].name).toBe('page_2.jpg');
      expect(result[2].name).toBe('page_3.jpg');
    });

    it('entfernt doppelte Seiten aus einer mehrseitigen Liste und behaelt die Reihenfolge bei', () => {
      const page1 = { name: 'page_1.jpg', size: 1200, lastModified: 1700000001000 };
      const page2 = { name: 'page_2.jpg', size: 1350, lastModified: 1700000002000 };
      const page1Duplicate = { name: 'page_1.jpg', size: 1200, lastModified: 1700000001000 };
      const page3 = { name: 'page_3.jpg', size: 1100, lastModified: 1700000003000 };

      const result = deduplicateRelayFiles([page1, page2, page1Duplicate, page3]);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('page_1.jpg');
      expect(result[1].name).toBe('page_2.jpg');
      expect(result[2].name).toBe('page_3.jpg');
    });
  });

  describe('assembleCapturedPages', () => {
    it('fuegt eine neue Seite zur leeren Liste hinzu', () => {
      const entry1 = {
        id: 'entry-1',
        file: { name: 'scan_p1.png', size: 2048, lastModified: 1700000000000 },
        previewUrl: 'blob:http://localhost/1',
      };

      const { pages, droppedCount } = assembleCapturedPages([], [entry1]);

      expect(pages).toHaveLength(1);
      expect(droppedCount).toBe(0);
      expect(pages[0].id).toBe('entry-1');
    });

    it('verhindert das doppelte Anfuegen identischer Seiten bei doppelten Events', () => {
      const entry1 = {
        id: 'entry-1',
        file: { name: 'scan_p1.png', size: 2048, lastModified: 1700000000000 },
        previewUrl: 'blob:http://localhost/1',
      };
      const duplicateEntry = {
        id: 'entry-1-duplicate',
        file: { name: 'scan_p1.png', size: 2048, lastModified: 1700000000000 },
        previewUrl: 'blob:http://localhost/2',
      };

      const { pages, droppedCount } = assembleCapturedPages([entry1], [duplicateEntry]);

      expect(pages).toHaveLength(1);
      expect(droppedCount).toBe(1);
      expect(pages[0].id).toBe('entry-1');
    });

    it('fuegt neue unterschiedliche Seiten korrekt in Reihenfolge an', () => {
      const entry1 = {
        id: 'entry-1',
        file: { name: 'p1.jpg', size: 1000, lastModified: 100 },
        previewUrl: 'blob:http://localhost/1',
      };
      const entry2 = {
        id: 'entry-2',
        file: { name: 'p2.jpg', size: 2000, lastModified: 200 },
        previewUrl: 'blob:http://localhost/2',
      };

      const { pages, droppedCount } = assembleCapturedPages([entry1], [entry2]);

      expect(pages).toHaveLength(2);
      expect(droppedCount).toBe(0);
      expect(pages[0].id).toBe('entry-1');
      expect(pages[1].id).toBe('entry-2');
    });
  });

  describe('deduplicatePayloadsByHash', () => {
    const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

    it('dedupliziert byte-identische Bild-Payloads zu genau 1 Seite', () => {
      const bufA = Buffer.from('FAKE_SCAN_IMAGE_DATA_PAGE_1');
      const payload1 = { id: 1, buffer: bufA, mimeType: 'image/png' };
      const payload2 = { id: 2, buffer: bufA, mimeType: 'image/png' };

      const result = deduplicatePayloadsByHash([payload1, payload2], (p) => sha256(p.buffer));

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('behaelt alle unterschiedlichen Seiten-Payloads in urspruenglicher Reihenfolge', () => {
      const buf1 = Buffer.from('PAGE_ONE_CONTENT');
      const buf2 = Buffer.from('PAGE_TWO_CONTENT');
      const buf3 = Buffer.from('PAGE_THREE_CONTENT');

      const payloads = [
        { id: 'p1', buffer: buf1, mimeType: 'image/jpeg' },
        { id: 'p2', buffer: buf2, mimeType: 'image/jpeg' },
        { id: 'p3', buffer: buf3, mimeType: 'image/jpeg' },
      ];

      const result = deduplicatePayloadsByHash(payloads, (p) => sha256(p.buffer));

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    });

    it('filtert Byte-Duplikate aus einer gemischten mehrseitigen Liste heraus', () => {
      const buf1 = Buffer.from('PAGE_ONE');
      const buf2 = Buffer.from('PAGE_TWO');
      const buf1Copy = Buffer.from('PAGE_ONE'); // Byte-identisch mit buf1
      const buf3 = Buffer.from('PAGE_THREE');

      const payloads = [
        { page: 1, buffer: buf1 },
        { page: 2, buffer: buf2 },
        { page: '1_dup', buffer: buf1Copy },
        { page: 3, buffer: buf3 },
      ];

      const result = deduplicatePayloadsByHash(payloads, (p) => sha256(p.buffer));

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.page)).toEqual([1, 2, 3]);
    });
  });
});
