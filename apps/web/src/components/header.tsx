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
    <header className="h-16 border-b border-warm-gray-100 bg-white/80 backdrop-blur-sm flex items-center justify-between px-8 sticky top-0 z-20">
      <h1 className="text-xl font-serif font-semibold text-charcoal">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        {/* Search / Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-mercury border border-warm-gray-200',
            'text-sm text-warm-gray-500 hover:text-charcoal hover:border-warm-gray-300',
            'transition-mercury bg-white hover:shadow-mercury-sm',
            'min-w-[240px]',
          )}
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="hidden sm:flex items-center gap-0.5 text-xs text-warm-gray-400 bg-warm-gray-100 px-1.5 py-0.5 rounded">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        {/* Notification Bell */}
        <button className="relative p-2.5 text-warm-gray-500 hover:text-charcoal hover:bg-warm-gray-100 rounded-mercury transition-mercury">
          <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-sienna rounded-full" />
        </button>

        {/* User Avatar */}
        <button className="w-8 h-8 rounded-full bg-gradient-to-br from-sienna-300 to-sienna flex items-center justify-center hover:shadow-mercury transition-mercury">
          <span className="text-white text-xs font-semibold">JD</span>
        </button>
      </div>
    </header>
  );
}
