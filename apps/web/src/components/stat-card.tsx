import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
}

export function StatCard({
  label,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="bg-surface-container rounded-md p-5 hover:shadow-elevation-1 transition-m3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-onSurface-variant uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-medium text-onSurface mt-1.5">
            {value}
          </p>
        </div>
        {Icon && (
          <div className="p-2 bg-primary-container rounded-md">
            <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
          </div>
        )}
      </div>
      {change && (
        <p
          className={cn(
            'text-xs font-medium mt-2',
            changeType === 'positive' && 'text-emerald-600',
            changeType === 'negative' && 'text-error',
            changeType === 'neutral' && 'text-onSurface-variant',
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
