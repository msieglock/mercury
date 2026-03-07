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
        'flex w-72 shrink-0 flex-col rounded-2xl border border-[#E5E2DE] bg-[#F5F3F0]',
        className,
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-[#E5E2DE] px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[#1A1815]">{title}</h3>
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E5E2DE] px-1.5 text-xs font-medium text-[#6B6560]">
            {count}
          </span>
        </div>
        {totalValue !== undefined && (
          <span className="text-xs font-medium text-[#6B6560]">
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
