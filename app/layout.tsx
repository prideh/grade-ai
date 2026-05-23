import type { Metadata } from 'next';
import ThemeRegistry from '@/lib/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'KlausurKI - Intelligente Klausurkorrektur für Lehrkräfte',
  description:
    'Die innovative deutsche K-12 Korrektur-Plattform. Automatisierte Klausurbewertung mit Handschrifterkennung, Teilpunktevergabe und mathematischer Folgenfehler-Berücksichtigung.',
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
