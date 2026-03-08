'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { CommandPalette } from '@/components/command-palette';
import { SidebarProvider } from '@/components/sidebar-provider';
import { DashboardContent } from '@/components/dashboard-content';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  return (
    <SidebarProvider>
      <div className="min-h-full bg-background">
        <Sidebar />
        <DashboardContent>
          <Header onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
          <main className="p-8">{children}</main>
        </DashboardContent>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </SidebarProvider>
  );
}
