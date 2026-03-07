import React from 'react';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#E5E2DE] bg-[#FAFAF8] px-8 py-16 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EEEB] text-[#6B6560]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[#1A1815]">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#6B6560]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-xl bg-[#D4552A] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#B8441F] focus:outline-none focus:ring-2 focus:ring-[#D4552A]/50 focus:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
