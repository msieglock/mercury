'use client';

import {
  MessageSquare,
  UserPlus,
  Calendar,
  Sparkles,
  ArrowRight,
  Clock,
  AlertTriangle,
  TrendingDown,
  User,
  Mail,
} from 'lucide-react';
import { cn, priorityColor } from '@/lib/utils';

interface ActionCardProps {
  id: string;
  type: string;
  title: string;
  description: string | null;
  priority: string;
  agentType: string;
  contactName: string | null;
  companyName: string | null;
  dueAt: string | null;
  primaryActionLabel: string;
  isOverdue: boolean;
  onAction?: () => void;
  onDismiss?: () => void;
  onSnooze?: () => void;
  isSelected?: boolean;
}

const typeIcons: Record<string, React.ElementType> = {
  follow_up: MessageSquare,
  reply_needed: Mail,
  warm_intro: UserPlus,
  meeting_prep: Calendar,
  new_prospect: Sparkles,
  deal_cold: TrendingDown,
  candidate_responded: User,
  log_notes: MessageSquare,
};

const agentLabels: Record<string, string> = {
  scout: 'Scout',
  composer: 'Composer',
  cadence: 'Cadence',
  analyst: 'Analyst',
  orchestrator: 'Orchestrator',
};

function timeEstimate(type: string): string {
  switch (type) {
    case 'reply_needed':
      return '~2 min';
    case 'follow_up':
      return '~1 min';
    case 'meeting_prep':
      return '~5 min';
    case 'warm_intro':
      return '~3 min';
    default:
      return '~1 min';
  }
}

export function ActionCard({
  type,
  title,
  description,
  priority,
  agentType,
  contactName,
  companyName,
  dueAt,
  primaryActionLabel,
  isOverdue,
  onAction,
  onDismiss,
  onSnooze,
  isSelected,
}: ActionCardProps) {
  const Icon = typeIcons[type] || Sparkles;

  return (
    <div
      className={cn(
        'group relative bg-surface-containerLow rounded-xl border border-outline-variant p-5 transition-m3 cursor-pointer',
        'hover:shadow-elevation-2 hover:border-outline',
        isSelected && 'ring-2 ring-primary/30 border-primary/20 shadow-elevation-2',
        isOverdue && 'border-l-[3px] border-l-error',
      )}
      tabIndex={0}
    >
      {/* Top row: agent badge + priority + time */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-onSecondary-container bg-secondary-container px-2 py-1 rounded-lg">
            <Sparkles className="w-3 h-3 text-primary" />
            {agentLabels[agentType] || 'AI'}
          </span>
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-lg capitalize',
              priorityColor(priority),
            )}
          >
            {priority}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-onSurface-variant">
          <Clock className="w-3 h-3" />
          {timeEstimate(type)}
        </div>
      </div>

      {/* Title + context */}
      <div className="mb-3">
        <h3 className="text-sm font-medium text-onSurface leading-snug">
          {title}
        </h3>
        {(contactName || companyName) && (
          <p className="text-xs text-onSurface-variant mt-1">
            {contactName}
            {companyName && ` at ${companyName}`}
          </p>
        )}
        {description && (
          <p className="text-xs text-onSurface-variant mt-1.5 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Overdue warning */}
      {isOverdue && (
        <div className="flex items-center gap-1.5 text-xs text-error mb-3">
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
          }}
          className={cn(
            'inline-flex items-center gap-1.5 px-6 h-10 text-sm font-medium rounded-full transition-m3',
            'bg-primary text-onPrimary hover:shadow-elevation-1',
            'group-hover:shadow-elevation-1',
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {primaryActionLabel}
          <ArrowRight className="w-3 h-3 opacity-0 -ml-1 group-hover:opacity-100 group-hover:ml-0 transition-all" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSnooze?.();
          }}
          className="px-4 h-8 text-sm font-medium text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3"
        >
          Snooze
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss?.();
          }}
          className="px-4 h-8 text-sm font-medium text-onSurface-variant hover:text-onSurface rounded-full transition-m3 opacity-0 group-hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
