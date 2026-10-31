import type { Metadata } from 'next';
import ThemeRegistry from '@/lib/ThemeRegistry';
import { getBaseUrl } from '@/lib/seo-url';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'prüefli - Intelligente Prüfungskorrektur für Lehrpersonen',
    template: '%s | prüefli',
  },
  description:
    'Die Schweizer Korrektur-Plattform für Schulen: Automatisierte Prüfungsbewertung mit Handschrifterkennung, Teilschritt-Bewertung und transparenter Fehleranalyse.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: [{ url: '/icon.svg' }],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        <ThemeRegistry>{children}</ThemeRegistry>
      </body>
    </html>
  );
}
