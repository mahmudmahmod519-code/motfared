import type { Metadata, Viewport } from 'next';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';
import '../styles/shell.css';
import { themeInitScript } from '../lib/theme';

export const metadata: Metadata = {
  title: 'Lead to Doctor — لوحة التحكم',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Arabic, right-to-left from the first byte; a pinned theme is applied before first paint (see lib/theme.ts).
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
