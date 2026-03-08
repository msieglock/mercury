'use client';

import { cn } from '@/lib/utils';

interface StatusBarProps {
  currentIndex: number;
  totalCount: number;
  mode: 'list' | 'thread';
}

export function StatusBar({ currentIndex, totalCount, mode }: StatusBarProps) {
  return (
    <div className="h-8 px-4 flex items-center justify-between border-t border-outline-variant bg-surface-container text-[11px] text-onSurface-variant select-none">
      <span className="font-medium">
        {totalCount > 0 ? `${currentIndex + 1} of ${totalCount}` : 'No threads'}
      </span>
      <div className="flex items-center gap-3">
        {mode === 'list' ? (
          <>
            <Hint keys="j/k" label="navigate" />
            <Hint keys="Enter" label="open" />
            <Hint keys="e" label="archive" />
            <Hint keys="/" label="search" />
            <Hint keys="?" label="help" />
          </>
        ) : (
          <>
            <Hint keys="Esc" label="back" />
            <Hint keys="r" label="reply" />
            <Hint keys="R" label="reply all" />
            <Hint keys="f" label="forward" />
            <Hint keys="e" label="archive" />
          </>
        )}
      </div>
    </div>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="px-1 py-0.5 bg-surface-containerHigh rounded text-[10px] font-mono font-medium text-onSurface-variant">
        {keys}
      </kbd>
      <span>{label}</span>
    </span>
  );
}
