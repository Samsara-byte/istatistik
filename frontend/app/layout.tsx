import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Burdur İl Tarım ve Orman Müdürlüğü – İstatistik Portalı',
  description: 'Burdur İl Tarımsal İstatistik Bilgi Sistemi',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
