'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Mail,
  User,
  BarChart3,
  Settings,
  ArrowRight,
  Command,
  CornerDownLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
  section: string;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = [
    {
      id: 'compose',
      label: 'Compose email',
      description: 'Draft a new message',
      icon: Mail,
      action: () => {
        router.push('/inbox');
        onClose();
      },
      shortcut: 'C',
      section: 'Quick Actions',
    },
    {
      id: 'find-contact',
      label: 'Find contact',
      description: 'Search your contacts',
      icon: User,
      action: () => {
        router.push('/people');
        onClose();
      },
      shortcut: '/P',
      section: 'Quick Actions',
    },
    {
      id: 'view-pipeline',
      label: 'View pipeline',
      description: 'Open pipeline board',
      icon: BarChart3,
      action: () => {
        router.push('/pipeline');
        onClose();
      },
      shortcut: '/B',
      section: 'Quick Actions',
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Manage your account',
      icon: Settings,
      action: () => {
        router.push('/settings');
        onClose();
      },
      shortcut: ',',
      section: 'Quick Actions',
    },
  ];

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase()),
  );

  const groupedCommands = filteredCommands.reduce(
    (acc, cmd) => {
      if (!acc[cmd.section]) acc[cmd.section] = [];
      acc[cmd.section].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>,
  );

  const flatList = filteredCommands;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (open) {
          onClose();
        }
      }
      if (!open) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatList[selectedIndex]) {
            flatList[selectedIndex].action();
          }
          break;
      }
    },
    [open, onClose, flatList, selectedIndex],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-white rounded-mercury-xl shadow-mercury-lg border border-warm-gray-200 overflow-hidden animate-slide-up">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 border-b border-warm-gray-100">
          <Search className="w-5 h-5 text-warm-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 py-4 text-sm bg-transparent outline-none placeholder:text-warm-gray-400 text-charcoal"
          />
          <kbd className="text-xs text-warm-gray-400 bg-warm-gray-100 px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scrollbar-mercury py-2">
          {Object.entries(groupedCommands).map(([section, items]) => (
            <div key={section}>
              <div className="px-5 py-2 text-xs font-medium text-warm-gray-500 uppercase tracking-wider">
                {section}
              </div>
              {items.map((item) => {
                const globalIndex = flatList.indexOf(item);
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    className={cn(
                      'w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-mercury',
                      globalIndex === selectedIndex
                        ? 'bg-warm-gray-100 text-charcoal'
                        : 'text-warm-gray-700 hover:bg-warm-gray-50',
                    )}
                  >
                    <item.icon className="w-4 h-4 text-warm-gray-400 flex-shrink-0" />
                    <div className="flex-1 text-left">
                      <span className="font-medium">{item.label}</span>
                      {item.description && (
                        <span className="ml-2 text-warm-gray-500">
                          {item.description}
                        </span>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="text-xs text-warm-gray-400 bg-warm-gray-100 px-1.5 py-0.5 rounded">
                        {item.shortcut}
                      </kbd>
                    )}
                    {globalIndex === selectedIndex && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-warm-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {flatList.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-warm-gray-500">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-warm-gray-100 flex items-center gap-4 text-xs text-warm-gray-400">
          <span className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3 rotate-90" /> Navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" /> Select
          </span>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />K Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
