import React from 'react';
import { cn } from '../lib/utils';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'flat';
  };
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-containerLow p-5 shadow-elevation-1',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container text-onSurface-variant">
          {icon}
        </span>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' && 'text-primary',
              trend.direction === 'down' && 'text-error',
              trend.direction === 'flat' && 'text-onSurface-variant',
            )}
          >
            {trend.direction === 'up' && '\u2191'}
            {trend.direction === 'down' && '\u2193'}
            {trend.direction === 'flat' && '\u2192'}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold text-primary">{value}</p>
        <p className="mt-0.5 text-sm text-onSurface-variant">{label}</p>
      </div>
    </div>
  );
}
