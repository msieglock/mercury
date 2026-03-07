import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mercury',
  description: 'Your AI-powered command center for relationship-driven business.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-cream text-charcoal font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
