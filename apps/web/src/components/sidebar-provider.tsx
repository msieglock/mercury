'use client';

import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

interface SidebarContextValue {
  collapsed: boolean;
  hovered: boolean;
  setCollapsed: (v: boolean) => void;
  setHovered: (v: boolean) => void;
  toggle: () => void;
}

export const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  // Auto-collapse on inbox route
  useEffect(() => {
    if (pathname === '/inbox') {
      setCollapsed(true);
    }
  }, [pathname]);

  const value: SidebarContextValue = { collapsed, hovered, setCollapsed, setHovered, toggle };

  // @ts-expect-error React 19 context provider JSX compatibility
  return <SidebarContext value={value}>{children}</SidebarContext>;
}
