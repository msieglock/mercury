'use client';

import { useSidebar } from '@/hooks/use-sidebar';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className="transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
      style={{ paddingLeft: collapsed ? 64 : 280 }}
    >
      {children}
    </div>
  );
}
