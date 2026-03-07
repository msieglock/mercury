import React from 'react';
import { cn } from '../lib/utils';

export interface PipelineColumnProps {
  title: string;
  count: number;
  totalValue?: number;
  children: React.ReactNode;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  className?: string;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}

export function PipelineColumn({
  title,
  count,
  totalValue,
  children,
  onDrop,
  onDragOver,
  className,
}: PipelineColumnProps) {
  return (
    <div
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-xl border border-outline-variant bg-surface-containerLow',
        className,
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-onSurface">{title}</h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-secondary-container px-1.5 text-xs font-medium text-onSecondary-container">
            {count}
          </span>
        </div>
        {totalValue !== undefined && (
          <span className="text-xs font-medium text-onSurface-variant">
            {formatCurrency(totalValue)}
          </span>
        )}
      </div>

      {/* Droppable area */}
      <div
        className="flex flex-1 flex-col gap-2 overflow-y-auto p-3"
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        {children}
      </div>
    </div>
  );
}
