import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveRelayOrigin, isLocalHost } from '@/lib/relay-url';

describe('Mobile Relay URL Resolution (lib/relay-url.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.BASE_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.RENDER;
    delete process.env.CI;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isLocalHost', () => {
    it('identifiziert lokale Hostnamen und Loopback-Adressen', () => {
      expect(isLocalHost('localhost')).toBe(true);
      expect(isLocalHost('localhost:3000')).toBe(true);
      expect(isLocalHost('127.0.0.1')).toBe(true);
      expect(isLocalHost('127.0.0.1:10000')).toBe(true);
      expect(isLocalHost('::1')).toBe(true);
      expect(isLocalHost('[::1]:3000')).toBe(true);
      expect(isLocalHost('0.0.0.0')).toBe(true);
    });

    it('unterscheidet externe Hostnamen und Produktionsadressen', () => {
      expect(isLocalHost('grade-ai-qkkc.onrender.com')).toBe(false);
      expect(isLocalHost('grade-ai-qkkc.onrender.com:443')).toBe(false);
      expect(isLocalHost('schule.ch')).toBe(false);
      expect(isLocalHost('10.0.0.5')).toBe(false);
    });
  });

  describe('Produktionsumgebung (NODE_ENV=production oder RENDER=true)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('nutzt x-forwarded-host und x-forwarded-proto vom Reverse-Proxy', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'grade-ai-qkkc.onrender.com',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://grade-ai-qkkc.onrender.com');
      expect(lanIp).toBeNull();
    });

    it('bereinigt Standard-Port 443 bei HTTPS-Forwarding', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'grade-ai-qkkc.onrender.com:443',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://grade-ai-qkkc.onrender.com');
      expect(lanIp).toBeNull();
    });

    it('behaelt Nicht-Standard-Ports im Forwarded-Host bei', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'demo.schule.ch:8443',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://demo.schule.ch:8443');
      expect(lanIp).toBeNull();
    });

    it('verarbeitet kommaseparierte Proxy-Ketten und nimmt den Client-Host', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'grade-ai-qkkc.onrender.com, internal-lb.render.com',
          'x-forwarded-proto': 'https, http',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://grade-ai-qkkc.onrender.com');
      expect(lanIp).toBeNull();
    });

    it('nutzt explizit konfigurierte APP_URL', () => {
      process.env.APP_URL = 'https://app.grade-ai.ch';

      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'grade-ai-qkkc.onrender.com',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://app.grade-ai.ch');
      expect(lanIp).toBeNull();
    });

    it('faellt auf RENDER_EXTERNAL_URL zurueck, wenn Forwarded-Header fehlen', () => {
      process.env.RENDER_EXTERNAL_URL = 'https://grade-ai-qkkc.onrender.com';

      const request = new Request('http://localhost:10000/api/mobile-relay');

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://grade-ai-qkkc.onrender.com');
      expect(lanIp).toBeNull();
    });

    it('substituiert in Produktion niemals eine interne LAN-IP (z.B. Container 10.x.x.x)', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay');

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).not.toContain('10.');
      expect(lanIp).toBeNull();
    });

    it('beachtet uebergebenen customOrigin und ignoriert Server-Header', () => {
      const request = new Request('http://localhost:10000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'grade-ai-qkkc.onrender.com',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request, 'https://custom-proxy.schule.ch/');
      expect(origin).toBe('https://custom-proxy.schule.ch');
      expect(lanIp).toBeNull();
    });
  });

  describe('Lokale Entwicklungsumgebung (NODE_ENV=development)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('bevorzugt customOrigin, falls vom Benutzer im Desktop-Dialog eingegeben', () => {
      const request = new Request('http://localhost:3000/api/mobile-relay');
      const { origin, lanIp } = resolveRelayOrigin(request, 'http://192.168.1.150:3000');
      expect(origin).toBe('http://192.168.1.150:3000');
      expect(lanIp).toBeNull();
    });

    it('erlaubt LAN-IP-Ersetzung fuer genuine lokale Entwicklung auf localhost', () => {
      const request = new Request('http://localhost:3000/api/mobile-relay');
      const { origin, lanIp } = resolveRelayOrigin(request);

      if (lanIp) {
        expect(origin).toBe(`http://${lanIp}:3000`);
      } else {
        expect(origin).toBe('http://localhost:3000');
      }
    });

    it('nutzt Tunnel-Domain, falls ueber ngrok / Forwarded-Host zugegriffen wird', () => {
      const request = new Request('http://localhost:3000/api/mobile-relay', {
        headers: {
          'x-forwarded-host': 'my-tunnel.ngrok-free.app',
          'x-forwarded-proto': 'https',
        },
      });

      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('https://my-tunnel.ngrok-free.app');
      expect(lanIp).toBeNull();
    });
  });

  describe('CI-Umgebung (CI=true)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
      process.env.CI = 'true';
    });

    it('verhindert unnoetige LAN-Ersetzung in automatisierten Testumgebungen', () => {
      const request = new Request('http://localhost:3000/api/mobile-relay');
      const { origin, lanIp } = resolveRelayOrigin(request);
      expect(origin).toBe('http://localhost:3000');
      expect(lanIp).toBeNull();
    });
  });
});
