'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Users,
  Mail,
  TrendingUp,
} from 'lucide-react';
import { ActionCard } from '@/components/action-card';
import { StatCard } from '@/components/stat-card';
import { apiClient } from '@/lib/api';
import { useUser } from '@/hooks/use-user';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

export default function TodayPage() {
  const { user } = useUser();
  const [actions, setActions] = useState<Record<string, unknown>[] | null>(null);
  const [contacts, setContacts] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient('/api/actions').catch(() => []),
      apiClient('/api/contacts').catch(() => []),
    ])
      .then(([actionsData, contactsData]) => {
        setActions(actionsData.actions || actionsData || []);
        setContacts(contactsData.contacts || contactsData || []);
      })
      .catch(() => {
        setError(true);
        setActions([]);
        setContacts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAction = useCallback(async (id: string) => {
    try {
      await apiClient(`/api/actions/${id}/send`, { method: 'POST' });
      setActions((prev) => (prev || []).filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to send action:', err);
    }
  }, []);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await apiClient(`/api/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'dismissed' }),
      });
      setActions((prev) => (prev || []).filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to dismiss action:', err);
    }
  }, []);

  const handleSnooze = useCallback(async (id: string) => {
    const snoozedUntil = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    try {
      await apiClient(`/api/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ snoozed_until: snoozedUntil }),
      });
      setActions((prev) => (prev || []).filter((a) => a.id !== id));
    } catch (err) {
      console.error('Failed to snooze action:', err);
    }
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="space-y-3">
          <div className="h-8 w-64 bg-surface-containerHigh rounded animate-pulse" />
          <div className="h-5 w-96 bg-surface-containerHigh rounded animate-pulse" />
        </div>
        <LoadingSkeleton variant="cards" />
        <LoadingSkeleton variant="list" rows={4} />
      </div>
    );
  }

  if (error && (!actions || actions.length === 0)) {
    return (
      <div className="max-w-7xl mx-auto">
        <ApiErrorState />
      </div>
    );
  }

  const mappedActions = (actions || []).map((a) => ({
    id: String(a.id || ''),
    type: String(a.type || a.action_type || 'follow_up'),
    title: String(a.title || ''),
    description: a.description ? String(a.description) : null,
    priority: String(a.priority || 'medium') as 'urgent' | 'high' | 'medium' | 'low',
    agentType: String(a.agentType || a.agent_type || 'scout'),
    contactName: a.contactName || a.contact_name ? String(a.contactName || a.contact_name) : null,
    companyName: a.companyName || a.company_name ? String(a.companyName || a.company_name) : null,
    dueAt: a.dueAt || a.due_at ? String(a.dueAt || a.due_at) : null,
    primaryActionLabel: String(a.primaryActionLabel || a.primary_action_label || 'View'),
    isOverdue: Boolean(a.isOverdue || a.is_overdue),
  }));

  const contactCount = (contacts || []).length;
  const urgentCount = mappedActions.filter(
    (a) => a.priority === 'urgent' || a.priority === 'high',
  ).length;

  const pipelineDisplay = user?.pipelineValue
    ? user.pipelineValue >= 1000
      ? `$${(user.pipelineValue / 1000).toFixed(0)}K`
      : `$${user.pipelineValue}`
    : '--';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Morning Briefing */}
      <div className="mb-8">
        <h2 className="text-2xl font-medium text-onSurface">
          {greeting}, {firstName}.
        </h2>
        <p className="text-onSurface-variant mt-1">
          Here&apos;s your day. You have{' '}
          <span className="font-medium text-onSurface">
            {mappedActions.length} actions
          </span>{' '}
          to review.
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <StatCard
            label="Actions Today"
            value={mappedActions.length}
            change={`${urgentCount} urgent`}
            changeType="neutral"
            icon={Zap}
          />
          <StatCard
            label="Contacts"
            value={contactCount}
            icon={Users}
          />
          <StatCard
            label="Emails Pending"
            value={mappedActions.filter((a) => a.type === 'reply_needed').length}
            change="needs reply"
            changeType="neutral"
            icon={Mail}
          />
          <StatCard
            label="Pipeline Value"
            value={pipelineDisplay}
            icon={TrendingUp}
          />
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-onSurface">Action Feed</h3>
          <div className="flex items-center gap-2 text-xs text-onSurface-variant">
            <span>Sorted by priority</span>
          </div>
        </div>

        <div className="space-y-3">
          {mappedActions.length === 0 ? (
            <div className="text-center py-12 text-sm text-onSurface-variant">
              No actions right now. You&apos;re all caught up!
            </div>
          ) : (
            mappedActions.map((action) => (
              <ActionCard
                key={action.id}
                id={action.id}
                type={action.type}
                title={action.title}
                description={action.description}
                priority={action.priority}
                agentType={action.agentType}
                contactName={action.contactName}
                companyName={action.companyName}
                dueAt={action.dueAt}
                primaryActionLabel={action.primaryActionLabel}
                isOverdue={action.isOverdue}
                onAction={() => handleAction(action.id)}
                onDismiss={() => handleDismiss(action.id)}
                onSnooze={() => handleSnooze(action.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
