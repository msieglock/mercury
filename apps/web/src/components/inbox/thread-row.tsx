'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';

export interface ThreadData {
  id: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  intent: string | null;
  hasAIDraft: boolean;
  contactId?: string;
}

interface ThreadRowProps {
  thread: ThreadData;
  isSelected: boolean;
  onClick: () => void;
}

const intentBadgeColors: Record<string, string> = {
  interested: 'bg-emerald-50 text-emerald-700',
  question: 'bg-blue-50 text-blue-700',
  objection: 'bg-amber-50 text-amber-700',
  not_now: 'bg-surface-containerHigh text-onSurface-variant',
  referral: 'bg-purple-50 text-purple-700',
  ooo: 'bg-surface-containerHigh text-onSurface-variant',
};

function ThreadRowInner({
  thread,
  isSelected,
  onClick,
}: ThreadRowProps) {
  return (
    <button
      onClick={onClick}
      data-thread-id={thread.id}
      className={cn(
        'w-full text-left px-5 py-3.5 border-b border-outline-variant transition-m3 flex items-start gap-3',
        isSelected
          ? 'bg-secondary-container/40'
          : 'hover:bg-surface-containerLow',
      )}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-semibold text-onPrimary">
          {getInitials(thread.contactName)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {thread.unread && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            )}
            <span
              className={cn(
                'text-sm truncate',
                thread.unread
                  ? 'font-semibold text-onSurface'
                  : 'font-normal text-onSurface-variant',
              )}
            >
              {thread.contactName}
            </span>
          </div>
          <span className="text-xs text-onSurface-variant flex-shrink-0">
            {formatRelativeTime(thread.timestamp)}
          </span>
        </div>
        <p
          className={cn(
            'text-sm truncate mt-0.5',
            thread.unread ? 'text-onSurface font-medium' : 'text-onSurface-variant',
          )}
        >
          {thread.subject}
        </p>
        <p className="text-xs text-onSurface-variant truncate mt-0.5">
          {thread.preview}
        </p>

        {/* Badges */}
        <div className="flex items-center gap-1.5 mt-1.5">
          {thread.intent && (
            <span
              className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded capitalize',
                intentBadgeColors[thread.intent] ||
                  'bg-surface-containerHigh text-onSurface-variant',
              )}
            >
              {thread.intent.replace('_', ' ')}
            </span>
          )}
          {thread.hasAIDraft && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-tertiary-container text-onTertiary-container">
              <Sparkles className="w-2.5 h-2.5" />
              AI Draft
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export const ThreadRow = React.memo(ThreadRowInner) as typeof ThreadRowInner;
