import type { Metadata } from 'next';
import ThemeRegistry from '@/lib/ThemeRegistry';
import './globals.css';

export const metadata: Metadata = {
  title: 'GradeAI - Intelligente Prüfungskorrektur für Lehrpersonen',
  description:
    'Die innovative Schweizer K-12 Korrektur-Plattform. Automatisierte Prüfungsbewertung mit Handschrifterkennung, Teilpunktevergabe und mathematischer Folgefehler-Berücksichtigung.',
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
