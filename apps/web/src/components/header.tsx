'use client';

import { usePathname } from 'next/navigation';
import { Search, Bell, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

const pageTitles: Record<string, string> = {
  '/today': 'Today',
  '/people': 'People',
  '/inbox': 'Inbox',
  '/pipeline': 'Pipeline',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
};

interface HeaderProps {
  onOpenCommandPalette?: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || 'Mercury';

  return (
    <header className="h-16 border-b border-outline-variant bg-surface/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-20">
      <h1 className="text-xl font-medium text-onSurface">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Search / Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-full border border-outline-variant',
            'text-sm text-onSurface-variant hover:text-onSurface hover:border-outline',
            'transition-m3 bg-surface-containerHigh hover:shadow-elevation-1',
            'min-w-[240px]',
          )}
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-onSurface-variant bg-surface-container px-1.5 py-0.5 rounded-sm">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        {/* Notification Bell */}
        <button className="relative p-2.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3">
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
        </button>

        {/* User Avatar */}
        <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:shadow-elevation-1 transition-m3">
          <span className="text-onPrimary text-xs font-semibold">JD</span>
        </button>
      </div>
    </header>
  );
}
