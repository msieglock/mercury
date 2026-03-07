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
    <div className="bg-white rounded-mercury-lg border border-warm-gray-200 p-5 hover:shadow-mercury transition-mercury">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-warm-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-2xl font-serif font-semibold text-charcoal mt-1.5">
            {value}
          </p>
        </div>
        {Icon && (
          <div className="p-2 bg-warm-gray-100 rounded-mercury">
            <Icon className="w-4 h-4 text-warm-gray-500" strokeWidth={1.5} />
          </div>
        )}
      </div>
      {change && (
        <p
          className={cn(
            'text-xs font-medium mt-2',
            changeType === 'positive' && 'text-emerald-600',
            changeType === 'negative' && 'text-red-500',
            changeType === 'neutral' && 'text-warm-gray-500',
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
