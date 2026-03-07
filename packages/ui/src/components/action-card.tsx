import React from 'react';
import { cn } from '../lib/utils';
import type { ActionCardType } from '@mercury/shared';
import { Badge } from './badge';

export interface ActionCardProps {
  action: ActionCardType;
  onPrimaryAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const priorityStyles: Record<ActionCardType['priority'], string> = {
  urgent: 'border-l-error',
  high: 'border-l-error',
  medium: 'border-l-tertiary',
  low: 'border-l-outline-variant',
};

const priorityBadgeVariant: Record<ActionCardType['priority'], 'danger' | 'accent' | 'warning' | 'default'> = {
  urgent: 'danger',
  high: 'accent',
  medium: 'warning',
  low: 'default',
};

const agentLabels: Record<string, string> = {
  scout: 'Scout',
  composer: 'Composer',
  cadence: 'Cadence',
  analyst: 'Analyst',
  orchestrator: 'Orchestrator',
};

export function ActionCard({
  action,
  onPrimaryAction,
  onDismiss,
  className,
}: ActionCardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-outline-variant border-l-4 bg-surface-containerLow p-5 shadow-elevation-1 transition-shadow hover:shadow-elevation-2',
        priorityStyles[action.priority],
        className,
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-onSurface">
            {action.title}
          </h3>
          {action.contact_name && (
            <p className="mt-0.5 text-xs text-onSurface-variant">
              {action.contact_name}
              {action.company_name && ` \u00B7 ${action.company_name}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={priorityBadgeVariant[action.priority]}>
            {action.priority}
          </Badge>
          <Badge variant="outline">{agentLabels[action.agent_type] ?? action.agent_type}</Badge>
        </div>
      </div>

      {/* Description */}
      {action.description && (
        <p className="mb-4 text-sm leading-relaxed text-onSurface-variant">
          {action.description}
        </p>
      )}

      {/* Overdue indicator */}
      {action.is_overdue && (
        <p className="mb-3 text-xs font-medium text-error">
          Overdue
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-onPrimary transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2"
        >
          {action.primary_action_label}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full px-4 py-2 text-sm font-medium text-onSurface-variant transition-colors hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-outline-variant focus:ring-offset-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
