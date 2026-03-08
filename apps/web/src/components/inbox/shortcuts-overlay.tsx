'use client';

import { X } from 'lucide-react';

interface ShortcutsOverlayProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: 'j / k', description: 'Move down / up' },
      { keys: 'Enter / o', description: 'Open thread' },
      { keys: 'Esc / u', description: 'Back to list' },
      { keys: 'g i', description: 'Go to Inbox' },
      { keys: '/', description: 'Search' },
      { keys: 'Tab', description: 'Next filter' },
      { keys: '⇧ Tab', description: 'Previous filter' },
      { keys: '1 – 5', description: 'Switch filter' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: 'e', description: 'Archive (Done)' },
      { keys: '#', description: 'Trash' },
      { keys: 'h', description: 'Remind me (Snooze)' },
      { keys: 's', description: 'Star / unstar' },
      { keys: 'u', description: 'Read / unread' },
      { keys: 'x', description: 'Select thread' },
      { keys: '⇧ J / ⇧ K', description: 'Select + move' },
      { keys: 'z', description: 'Undo last action' },
    ],
  },
  {
    title: 'Compose & Reply',
    shortcuts: [
      { keys: 'c', description: 'Compose new' },
      { keys: 'r', description: 'Reply' },
      { keys: '⇧ R', description: 'Reply all' },
      { keys: 'f', description: 'Forward' },
    ],
  },
  {
    title: 'Thread View',
    shortcuts: [
      { keys: 'n / p', description: 'Next / prev message' },
      { keys: 'o', description: 'Expand all messages' },
      { keys: 'Space', description: 'Scroll down' },
      { keys: '⇧ Space', description: 'Scroll up' },
      { keys: 'j / k', description: 'Next / prev thread' },
      { keys: '?', description: 'Keyboard shortcuts' },
    ],
  },
];

export function ShortcutsOverlay({ open, onClose }: ShortcutsOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-surface rounded-xl border border-outline-variant shadow-elevation-3 w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-base font-medium text-onSurface">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-lg transition-m3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto scrollbar-m3">
          <div className="grid grid-cols-2 gap-8">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-medium text-onSurface-variant uppercase tracking-wider mb-3">
                  {section.title}
                </h3>
                <div className="space-y-2">
                  {section.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.keys}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-onSurface-variant">
                        {shortcut.description}
                      </span>
                      <kbd className="px-2 py-0.5 bg-surface-containerHigh rounded text-xs font-mono font-medium text-onSurface-variant whitespace-nowrap">
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant text-xs text-onSurface-variant text-center">
          Press <kbd className="px-1.5 py-0.5 bg-surface-containerHigh rounded font-mono">Esc</kbd> or <kbd className="px-1.5 py-0.5 bg-surface-containerHigh rounded font-mono">?</kbd> to close
        </div>
      </div>
    </div>
  );
}
