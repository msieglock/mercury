import React from 'react';
import { cn } from '../lib/utils';

export interface BriefingStat {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}

export interface PipelineHealth {
  stage: string;
  count: number;
  percentage: number;
}

export interface MorningBriefingProps {
  userName: string;
  greeting?: string;
  stats: BriefingStat[];
  pipelineHealth: PipelineHealth[];
  className?: string;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function MorningBriefing({
  userName,
  greeting,
  stats,
  pipelineHealth,
  className,
}: MorningBriefingProps) {
  const displayGreeting = greeting ?? getTimeBasedGreeting();
  const firstName = userName.split(' ')[0];

  return (
    <div
      className={cn(
        'rounded-xl border border-outline-variant bg-surface-containerLow p-6 shadow-elevation-1',
        className,
      )}
    >
      {/* Greeting */}
      <h2 className="text-xl font-semibold text-onSurface">
        {displayGreeting}, {firstName}
      </h2>
      <p className="mt-1 text-sm text-onSurface-variant">
        Here&apos;s what needs your attention today.
      </p>

      {/* Stats row */}
      <div className="mt-5 flex gap-4 overflow-x-auto">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex min-w-[120px] flex-1 flex-col items-center gap-1 rounded-xl bg-surface-container px-4 py-3"
          >
            {stat.icon && (
              <span className="text-onSurface-variant">{stat.icon}</span>
            )}
            <span className="text-lg font-semibold text-primary">
              {stat.value}
            </span>
            <span className="text-xs text-onSurface-variant">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Pipeline health bar */}
      {pipelineHealth.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-onSurface-variant">
            Pipeline Health
          </h3>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-variant">
            {pipelineHealth.map((segment, i) => {
              const colors = [
                'bg-primary',
                'bg-secondary',
                'bg-tertiary',
                'bg-primary-container',
                'bg-secondary-container',
                'bg-tertiary-container',
                'bg-outline',
                'bg-outline-variant',
              ];
              return (
                <div
                  key={segment.stage}
                  className={cn(
                    'h-full transition-all',
                    colors[i % colors.length],
                  )}
                  style={{ width: `${segment.percentage}%` }}
                  title={`${segment.stage}: ${segment.count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {pipelineHealth.map((segment, i) => {
              const dotColors = [
                'bg-primary',
                'bg-secondary',
                'bg-tertiary',
                'bg-primary-container',
                'bg-secondary-container',
                'bg-tertiary-container',
                'bg-outline',
                'bg-outline-variant',
              ];
              return (
                <div key={segment.stage} className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      dotColors[i % dotColors.length],
                    )}
                  />
                  <span className="text-xs text-onSurface-variant">
                    {segment.stage} ({segment.count})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
