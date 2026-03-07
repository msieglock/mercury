'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sun,
  Users,
  Inbox,
  BarChart3,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Today', href: '/today', icon: Sun },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Inbox', href: '/inbox', icon: Inbox },
  { label: 'Pipeline', href: '/pipeline', icon: BarChart3 },
  { label: 'Analytics', href: '/analytics', icon: TrendingUp },
];

const bottomItems = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[280px] bg-surface border-r border-outline-variant flex flex-col z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-7 border-b border-outline-variant">
        <Link href="/today" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:shadow-elevation-1 transition-m3">
            <span className="text-onPrimary text-sm font-bold">M</span>
          </div>
          <span className="text-lg font-medium tracking-tight text-onSurface">
            Mercury
          </span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto scrollbar-m3">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-m3',
                isActive
                  ? 'bg-secondary-container text-onSecondary-container'
                  : 'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
              )}
            >
              <item.icon
                className={cn(
                  'w-[18px] h-[18px] flex-shrink-0',
                  isActive ? 'text-onSecondary-container' : 'text-onSurface-variant',
                )}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span>{item.label}</span>
              {item.label === 'Inbox' && (
                <span
                  className={cn(
                    'ml-auto text-xs px-2 py-0.5 rounded-full font-medium',
                    isActive
                      ? 'bg-primary text-onPrimary'
                      : 'bg-primary-container text-onPrimary-container',
                  )}
                >
                  3
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="px-4 py-3 border-t border-outline-variant space-y-1">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-m3',
                isActive
                  ? 'bg-secondary-container text-onSecondary-container'
                  : 'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
              )}
            >
              <item.icon
                className={cn(
                  'w-[18px] h-[18px]',
                  isActive ? 'text-onSecondary-container' : 'text-onSurface-variant',
                )}
                strokeWidth={1.5}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* User profile */}
        <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-onPrimary text-xs font-semibold">JD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-onSurface truncate">
              John Doe
            </p>
            <p className="text-xs text-onSurface-variant truncate">
              john@company.com
            </p>
          </div>
          <button className="p-1 text-onSurface-variant hover:text-onSurface transition-m3 rounded-lg hover:bg-surface-containerHigh">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
