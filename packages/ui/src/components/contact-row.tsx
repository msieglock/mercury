import React from 'react';
import { cn } from '../lib/utils';
import {
  type OutreachPath,
  getOutreachPathIcon,
  formatRelativeTime,
} from '@mercury/shared';
import { Avatar } from './avatar';

export interface ContactRowProps {
  name: string;
  title?: string | null;
  company?: string | null;
  avatarUrl?: string | null;
  outreachPath?: OutreachPath | null;
  relationshipScore: number;
  lastInteractionAt?: string | null;
  onClick?: () => void;
  className?: string;
}

export function ContactRow({
  name,
  title,
  company,
  avatarUrl,
  outreachPath,
  relationshipScore,
  lastInteractionAt,
  onClick,
  className,
}: ContactRowProps) {
  const relativeTime = lastInteractionAt
    ? formatRelativeTime(new Date(lastInteractionAt))
    : null;

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-containerLow px-5 py-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-surface-containerHigh',
        className,
      )}
    >
      {/* Avatar */}
      <Avatar name={name} src={avatarUrl} size="md" />

      {/* Name & title */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-onSurface">{name}</p>
        {(title || company) && (
          <p className="truncate text-xs text-onSurface-variant">
            {title}
            {title && company && ' \u00B7 '}
            {company}
          </p>
        )}
      </div>

      {/* Outreach path icon */}
      {outreachPath && (
        <span className="shrink-0 text-base" title={outreachPath}>
          {getOutreachPathIcon(outreachPath)}
        </span>
      )}

      {/* Relationship score bar */}
      <div className="flex w-20 shrink-0 flex-col items-end gap-1">
        <span className="text-xs font-medium text-onSurface-variant">{relationshipScore}</span>
        <div className="h-1.5 w-full rounded-full bg-surface-variant">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(100, relationshipScore)}%` }}
          />
        </div>
      </div>

      {/* Last interaction */}
      {relativeTime && (
        <span className="shrink-0 text-xs text-onSurface-variant">{relativeTime}</span>
      )}
    </div>
  );
}
