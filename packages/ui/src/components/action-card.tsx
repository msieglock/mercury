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
  urgent: 'border-l-red-500',
  high: 'border-l-[#D4552A]',
  medium: 'border-l-amber-400',
  low: 'border-l-[#E5E2DE]',
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
        'relative rounded-2xl border border-[#E5E2DE] border-l-4 bg-[#FAFAF8] p-5 shadow-sm transition-shadow hover:shadow-md',
        priorityStyles[action.priority],
        className,
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-[#1A1815]">
            {action.title}
          </h3>
          {action.contact_name && (
            <p className="mt-0.5 text-xs text-[#6B6560]">
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
        <p className="mb-4 text-sm leading-relaxed text-[#6B6560]">
          {action.description}
        </p>
      )}

      {/* Overdue indicator */}
      {action.is_overdue && (
        <p className="mb-3 text-xs font-medium text-red-500">
          Overdue
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="rounded-xl bg-[#D4552A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#B8441F] focus:outline-none focus:ring-2 focus:ring-[#D4552A]/50 focus:ring-offset-2"
        >
          {action.primary_action_label}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl px-4 py-2 text-sm font-medium text-[#6B6560] transition-colors hover:bg-[#F0EEEB] focus:outline-none focus:ring-2 focus:ring-[#E5E2DE] focus:ring-offset-2"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
