import os from 'os';

/**
 * Ermittelt die beste lokale LAN-IPv4-Adresse fuer echte lokale Entwicklung (z. B. im Heim-/Schul-WLAN).
 * Ignoriert virtuelle Netzwerkadapter (Docker, WSL, VMware, VirtualBox).
 */
export function getLocalLanIp(): string | null {
  try {
    const nets = os.networkInterfaces();
    const candidates: string[] = [];

    for (const name of Object.keys(nets)) {
      const lowerName = name.toLowerCase();
      if (
        lowerName.includes('wsl') ||
        lowerName.includes('docker') ||
        lowerName.includes('veth') ||
        lowerName.includes('vmware') ||
        lowerName.includes('virtualbox') ||
        lowerName.includes('vbox')
      ) {
        continue;
      }

      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          candidates.push(net.address);
        }
      }
    }

    // Bevorzuge gaengige lokale Subnetze (192.168.x.x oder 10.x.x.x)
    const homeLan = candidates.find((ip) => ip.startsWith('192.168.'));
    if (homeLan) return homeLan;

    const tenLan = candidates.find((ip) => ip.startsWith('10.'));
    if (tenLan) return tenLan;

    if (candidates.length > 0) return candidates[0];

    // Fallback: Beliebige nicht-interne IPv4-Adresse
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
  } catch {
    // Fehler bei OS-Netzwerkschnittstellen ignorieren
  }
  return null;
}

function normalizeOrigin(url: string): string {
  let trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

function cleanHost(host: string, proto: string): string {
  if (proto === 'https' && host.endsWith(':443')) {
    return host.slice(0, -4);
  }
  if (proto === 'http' && host.endsWith(':80')) {
    return host.slice(0, -3);
  }
  return host;
}

export function isLocalHost(hostOrHostname: string): boolean {
  const trimmed = hostOrHostname.trim().toLowerCase();
  if (
    trimmed === 'localhost' ||
    trimmed === '127.0.0.1' ||
    trimmed === '0.0.0.0' ||
    trimmed === '::1' ||
    trimmed === '[::1]'
  ) {
    return true;
  }
  if (
    trimmed.startsWith('localhost:') ||
    trimmed.startsWith('127.0.0.1:') ||
    trimmed.startsWith('0.0.0.0:') ||
    trimmed.startsWith('[::1]:')
  ) {
    return true;
  }
  return false;
}

export interface ResolvedRelayOrigin {
  origin: string;
  lanIp: string | null;
}

/**
 * Loest den korrekten Basis-Origin fuer Mobile-Relay-QR-Codes und -Scan-URLs auf.
 *
 * Prioritaeten:
 * 1. Expliziter customOrigin aus dem Request-Body (z. B. manuelle Eingabe im Desktop-Dialog).
 * 2. Konfigurierte Basis-URL aus Umgebungsvariablen (APP_URL, NEXT_PUBLIC_APP_URL, BASE_URL).
 * 3. Forwarded-Header vom Reverse-Proxy (x-forwarded-host, x-forwarded-proto).
 * 4. Render-automatische externe URL (RENDER_EXTERNAL_URL).
 * 5. Bei echter lokaler Entwicklung (nicht Produktion, nicht CI, Host ist localhost/127.0.0.1):
 *    LAN-IP-Ersetzung fuer Smartphones im selben WLAN.
 * 6. Fallback auf Request-URL bzw. Host-Header ohne LAN-Ersetzung.
 */
export function resolveRelayOrigin(
  request: Request,
  customOrigin?: string | null
): ResolvedRelayOrigin {
  // 1. Expliziter customOrigin
  if (customOrigin && customOrigin.trim()) {
    return {
      origin: normalizeOrigin(customOrigin),
      lanIp: null,
    };
  }

  // 2. Konfigurierte Basis-URL ueber Umgebungsvariablen
  const configuredBaseUrl =
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.BASE_URL;

  if (configuredBaseUrl && configuredBaseUrl.trim()) {
    return {
      origin: normalizeOrigin(configuredBaseUrl),
      lanIp: null,
    };
  }

  // 3. Forwarded-Header von Reverse-Proxies (Render, Vercel, Cloudflare, Traefik, Nginx)
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim();
  const rawProto =
    request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ||
    request.headers.get('x-forwarded-protocol')?.split(',')[0].trim() ||
    (request.headers.get('x-forwarded-ssl') === 'on' ? 'https' : null);

  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

  if (forwardedHost && !isLocalHost(forwardedHost)) {
    const proto = rawProto || (isProduction ? 'https' : 'http');
    const cleaned = cleanHost(forwardedHost, proto);
    return {
      origin: `${proto}://${cleaned}`,
      lanIp: null,
    };
  }

  // 4. Render-spezifische externe URL (wenn Forwarded-Header fehlen)
  if (process.env.RENDER_EXTERNAL_URL && process.env.RENDER_EXTERNAL_URL.trim()) {
    return {
      origin: normalizeOrigin(process.env.RENDER_EXTERNAL_URL),
      lanIp: null,
    };
  }

  // 5. Host-Header und Request-URL
  const reqUrl = new URL(request.url);
  const hostHeader = request.headers.get('host')?.split(',')[0].trim();
  const effectiveHost = hostHeader || reqUrl.host;

  // Echte lokale Entwicklung: nur wenn explizit nicht Produktion, nicht CI und auf localhost zugegriffen wird
  const isGenuineLocalDev = !isProduction && !process.env.CI && isLocalHost(effectiveHost);

  if (isGenuineLocalDev) {
    const lanIp = getLocalLanIp();
    if (lanIp) {
      const port = reqUrl.port ? `:${reqUrl.port}` : '';
      return {
        origin: `${reqUrl.protocol}//${lanIp}${port}`,
        lanIp,
      };
    }
    return {
      origin: reqUrl.origin,
      lanIp: null,
    };
  }

  // In Produktion oder bei Zugriff ueber externen Host-Header:
  if (effectiveHost && !isLocalHost(effectiveHost)) {
    const proto = rawProto || (isProduction ? 'https' : reqUrl.protocol.replace(':', ''));
    const cleaned = cleanHost(effectiveHost, proto);
    return {
      origin: `${proto}://${cleaned}`,
      lanIp: null,
    };
  }

  // Fallback (z. B. Container-interne Adresse in Produktion ohne Proxydaten - niemals LAN-IP substituieren)
  return {
    origin: reqUrl.origin,
    lanIp: null,
  };
}
