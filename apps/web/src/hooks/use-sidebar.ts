'use client';

import { useContext } from 'react';
import { SidebarContext } from '@/components/sidebar-provider';

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebar must be used within SidebarProvider');
  }
  return ctx;
}
