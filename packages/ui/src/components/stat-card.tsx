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
        'flex flex-col gap-3 rounded-2xl border border-[#E5E2DE] bg-[#FAFAF8] p-5 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0EEEB] text-[#6B6560]">
          {icon}
        </span>
        {trend && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' && 'text-emerald-600',
              trend.direction === 'down' && 'text-red-500',
              trend.direction === 'flat' && 'text-[#6B6560]',
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
        <p className="text-2xl font-semibold text-[#1A1815]">{value}</p>
        <p className="mt-0.5 text-sm text-[#6B6560]">{label}</p>
      </div>
    </div>
  );
}
