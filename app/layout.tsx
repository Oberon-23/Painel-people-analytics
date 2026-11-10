import type { Metadata, Viewport } from 'next';
import './globals.css';
import { lerTema } from '@/lib/tema';

export const metadata: Metadata = {
  title: 'Rotalume · People Analytics',
  description: 'Painel de RH em que o banco de dados decide o que cada pessoa pode ver. Dados fictícios.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f3ee' },
    { media: '(prefers-color-scheme: dark)', color: '#14161c' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await lerTema();
  return (
    <html lang="pt-BR" data-theme={tema === 'escuro' ? 'dark' : tema === 'claro' ? 'light' : undefined} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
