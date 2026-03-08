'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell, Command, PanelLeftOpen, PanelLeftClose, Check } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useUser } from '@/hooks/use-user';
import { apiClient } from '@/lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

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
  const { collapsed, toggle } = useSidebar();
  const { user } = useUser();
  const title = pageTitles[pathname] || 'Mercury';
  const isInbox = pathname === '/inbox';

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(user?.unreadNotifications || 0);
  const [notifLoading, setNotifLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.unreadNotifications !== undefined) {
      setUnreadCount(user.unreadNotifications);
    }
  }, [user?.unreadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifLoading(true);
    try {
      const data = await apiClient('/api/notifications');
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      // silent
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const toggleNotifs = useCallback(() => {
    if (!showNotifs) {
      fetchNotifications();
    }
    setShowNotifs((v) => !v);
  }, [showNotifs, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    try {
      await apiClient(`/api/notifications/${id}`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await apiClient('/api/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  return (
    <header
      className={cn(
        'border-b border-outline-variant bg-surface/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20',
        isInbox ? 'h-12' : 'h-16',
      )}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-1.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-lg transition-m3"
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
          )}
        </button>
        <h1
          className={cn(
            'font-medium text-onSurface',
            isInbox ? 'text-base' : 'text-xl',
          )}
        >
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {!isInbox && (
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
        )}

        {/* Notification Bell */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={toggleNotifs}
            className="relative p-2.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 flex items-center justify-center bg-error text-onError text-[10px] font-bold rounded-full px-1">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-surface-containerHigh rounded-xl shadow-elevation-3 border border-outline-variant overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-outline-variant flex items-center justify-between">
                <h3 className="text-sm font-medium text-onSurface">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifLoading && notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-onSurface-variant">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-onSurface-variant">No notifications</div>
                ) : (
                  notifications.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => !n.read && markRead(n.id)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-outline-variant/50 hover:bg-surface-container transition-m3',
                        !n.read && 'bg-primary/[0.04]',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm truncate', !n.read ? 'font-medium text-onSurface' : 'text-onSurface-variant')}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-onSurface-variant truncate mt-0.5">{n.body}</p>
                          )}
                          <p className="text-[10px] text-onSurface-variant/60 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <button className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:shadow-elevation-1 transition-m3">
          <span className="text-onPrimary text-xs font-semibold">
            {user ? getInitials(user.full_name) : '..'}
          </span>
        </button>
      </div>
    </header>
  );
}
