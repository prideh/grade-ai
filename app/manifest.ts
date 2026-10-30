import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GradeAI - Intelligente Prüfungskorrektur',
    short_name: 'GradeAI',
    description: 'Automatisierte Prüfungsbewertung mit Handschrifterkennung für Lehrpersonen.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#1b77d1',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
  };
}
