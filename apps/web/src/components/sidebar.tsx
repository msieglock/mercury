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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useUser } from '@/hooks/use-user';

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
  const { collapsed, hovered, setHovered, toggle } = useSidebar();
  const { user } = useUser();

  const displayName = user?.full_name || 'User';
  const displayEmail = user?.email || '';
  const initials = getInitials(displayName);

  // Effective expanded = not collapsed OR hovered
  const expanded = !collapsed || hovered;

  return (
    <>
      {/* Sidebar */}
      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed left-0 top-0 bottom-0 bg-surface border-r border-outline-variant flex flex-col z-30',
          'transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          // When collapsed + hovered: overlay mode (fixed, wider, shadow)
          collapsed && hovered && 'shadow-elevation-3',
        )}
        style={{ width: expanded ? 280 : 64 }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-outline-variant">
          <Link href="/today" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center group-hover:shadow-elevation-1 transition-m3 flex-shrink-0">
              <span className="text-onPrimary text-sm font-bold">M</span>
            </div>
            {expanded && (
              <span className="text-lg font-medium tracking-tight text-onSurface whitespace-nowrap">
                Mercury
              </span>
            )}
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto scrollbar-m3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 py-2.5 rounded-full text-sm font-medium transition-m3',
                  expanded ? 'px-3' : 'px-0 justify-center',
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
                {expanded && <span>{item.label}</span>}
                {expanded && item.label === 'Inbox' && (
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
                {!expanded && item.label === 'Inbox' && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="px-2 py-3 border-t border-outline-variant space-y-1">
          {/* Toggle button */}
          <button
            onClick={toggle}
            className={cn(
              'flex items-center gap-3 py-2.5 rounded-full text-sm font-medium transition-m3 w-full',
              expanded ? 'px-3' : 'px-0 justify-center',
              'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            ) : (
              <PanelLeftClose className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            )}
            {expanded && <span>{collapsed ? 'Expand' : 'Collapse'}</span>}
          </button>

          {bottomItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!expanded ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 py-2.5 rounded-full text-sm font-medium transition-m3',
                  expanded ? 'px-3' : 'px-0 justify-center',
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
                  strokeWidth={1.5}
                />
                {expanded && <span>{item.label}</span>}
              </Link>
            );
          })}

          {/* User profile */}
          <div className={cn(
            'flex items-center gap-3 py-2.5 mt-2',
            expanded ? 'px-3' : 'px-0 justify-center',
          )}>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-onPrimary text-xs font-semibold">{initials}</span>
            </div>
            {expanded && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-onSurface truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-onSurface-variant truncate">
                    {displayEmail}
                  </p>
                </div>
                <button className="p-1 text-onSurface-variant hover:text-onSurface transition-m3 rounded-lg hover:bg-surface-containerHigh">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
