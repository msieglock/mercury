'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Mail,
  Clock,
  Target,
  BarChart3,
  Activity,
  Bot,
  DollarSign,
} from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

interface AnalyticsData {
  pipeline: { total_value: number; deal_count: number };
  contacts: { new_last_30d: number; by_segment: Record<string, number> };
  response_time: { avg_hours: number | null };
  interactions: { by_channel: Record<string, { inbound: number; outbound: number }> };
  actions: { total: number; completed: number; completion_rate: number; by_status: Record<string, number> };
  ai: { total_calls: number; total_tokens: number; avg_latency_ms: number | null };
  weekly_activity: Array<{ day: string; count: number; direction: string }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiClient('/api/analytics')
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <LoadingSkeleton variant="cards" />
        <LoadingSkeleton variant="list" rows={5} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="max-w-6xl mx-auto"><ApiErrorState /></div>;
  }

  // Aggregate interactions
  const totalOutbound = Object.values(data.interactions.by_channel).reduce((s, c) => s + c.outbound, 0);
  const totalInbound = Object.values(data.interactions.by_channel).reduce((s, c) => s + c.inbound, 0);
  const totalInteractions = totalOutbound + totalInbound;
  const responseRate = totalOutbound > 0 ? Math.round((totalInbound / totalOutbound) * 100) : 0;
  const totalContacts = Object.values(data.contacts.by_segment).reduce((s, c) => s + c, 0);

  // Parse weekly activity into days
  const activityByDay: Record<string, { inbound: number; outbound: number }> = {};
  for (const row of data.weekly_activity) {
    if (!activityByDay[row.day]) activityByDay[row.day] = { inbound: 0, outbound: 0 };
    activityByDay[row.day][row.direction as 'inbound' | 'outbound'] += row.count;
  }
  const activityDays = Object.entries(activityByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, counts]) => ({
      label: new Date(day + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' }),
      ...counts,
      total: counts.inbound + counts.outbound,
    }));
  const maxActivity = Math.max(...activityDays.map((d) => d.total), 1);

  // Segment breakdown
  const segments = Object.entries(data.contacts.by_segment)
    .sort(([, a], [, b]) => b - a);

  const segmentLabels: Record<string, string> = {
    inner_circle: 'Inner Circle',
    active_deal: 'Active Deal',
    keep_warm: 'Keep Warm',
    dormant: 'Dormant',
  };

  const segmentColors: Record<string, string> = {
    inner_circle: 'bg-primary',
    active_deal: 'bg-tertiary',
    keep_warm: 'bg-secondary',
    dormant: 'bg-outline-variant',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Pipeline Value"
          value={`$${(data.pipeline.total_value / 1000).toFixed(0)}K`}
          change={`${data.pipeline.deal_count} deals`}
          changeType="neutral"
          icon={DollarSign}
        />
        <StatCard
          label="Response Rate"
          value={`${responseRate}%`}
          change={`${totalInbound} replies / ${totalOutbound} sent`}
          changeType={responseRate > 30 ? 'positive' : 'neutral'}
          icon={Target}
        />
        <StatCard
          label="Avg Response Time"
          value={data.response_time.avg_hours != null ? `${data.response_time.avg_hours}h` : '--'}
          change="last 30 days"
          changeType="neutral"
          icon={Clock}
        />
        <StatCard
          label="Contacts"
          value={totalContacts}
          change={`+${data.contacts.new_last_30d} this month`}
          changeType={data.contacts.new_last_30d > 0 ? 'positive' : 'neutral'}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-[1fr_380px] gap-6">
        {/* LEFT */}
        <div className="space-y-6">
          {/* Weekly Activity Chart */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Activity className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">Weekly Activity</h3>
            </div>
            <div className="px-5 py-6">
              {activityDays.length > 0 ? (
                <>
                  <div className="flex items-end gap-3 h-40">
                    {activityDays.map((day) => (
                      <div key={day.label} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex flex-col gap-0.5 items-center">
                          <div
                            className="w-full bg-primary/30 rounded-t"
                            style={{ height: `${(day.inbound / maxActivity) * 120}px` }}
                          />
                          <div
                            className="w-full bg-primary/80 rounded-t"
                            style={{ height: `${(day.outbound / maxActivity) * 120}px` }}
                          />
                        </div>
                        <span className="text-xs text-onSurface-variant mt-2">{day.label}</span>
                        <span className="text-[10px] text-onSurface-variant">{day.total}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 text-xs text-onSurface-variant">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary/80" /> Outbound
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary/30" /> Inbound
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-onSurface-variant">
                  No activity data yet
                </div>
              )}
            </div>
          </div>

          {/* Channel Breakdown */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Mail className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">Interactions by Channel</h3>
            </div>
            <div className="divide-y divide-outline-variant">
              <div className="grid grid-cols-4 px-5 py-2.5 text-xs font-medium text-onSurface-variant uppercase tracking-wider">
                <div>Channel</div>
                <div>Inbound</div>
                <div>Outbound</div>
                <div>Total</div>
              </div>
              {Object.entries(data.interactions.by_channel).map(([channel, counts]) => (
                <div key={channel} className="grid grid-cols-4 px-5 py-3.5 items-center">
                  <div className="text-sm font-medium text-onSurface capitalize">{channel}</div>
                  <div className="text-sm text-onSurface-variant">{counts.inbound}</div>
                  <div className="text-sm text-onSurface-variant">{counts.outbound}</div>
                  <div className="text-sm font-medium text-onSurface">{counts.inbound + counts.outbound}</div>
                </div>
              ))}
              {Object.keys(data.interactions.by_channel).length === 0 && (
                <div className="px-5 py-6 text-center text-sm text-onSurface-variant">No interaction data yet</div>
              )}
            </div>
          </div>

          {/* AI Usage */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Bot className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">AI Usage (Last 30 Days)</h3>
            </div>
            <div className="grid grid-cols-3 divide-x divide-outline-variant">
              <div className="px-5 py-5 text-center">
                <p className="text-2xl font-medium text-onSurface">{data.ai.total_calls}</p>
                <p className="text-xs text-onSurface-variant mt-1">API Calls</p>
              </div>
              <div className="px-5 py-5 text-center">
                <p className="text-2xl font-medium text-onSurface">
                  {data.ai.total_tokens ? `${(data.ai.total_tokens / 1000).toFixed(1)}K` : '0'}
                </p>
                <p className="text-xs text-onSurface-variant mt-1">Tokens Used</p>
              </div>
              <div className="px-5 py-5 text-center">
                <p className="text-2xl font-medium text-onSurface">
                  {data.ai.avg_latency_ms ? `${data.ai.avg_latency_ms}ms` : '--'}
                </p>
                <p className="text-xs text-onSurface-variant mt-1">Avg Latency</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Contact Segments */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Users className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">Contact Segments</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              {segments.map(([segment, count]) => (
                <div key={segment}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-onSurface">{segmentLabels[segment] ?? segment}</span>
                    <span className="text-sm font-mono text-onSurface-variant">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-containerHigh rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', segmentColors[segment] ?? 'bg-outline')}
                      style={{ width: `${totalContacts > 0 ? (count / totalContacts) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
              {segments.length === 0 && (
                <p className="text-sm text-onSurface-variant text-center py-4">No contacts yet</p>
              )}
            </div>
          </div>

          {/* Action Completion */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">Action Completion</h3>
            </div>
            <div className="px-5 py-5">
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8"
                      fill="none" className="text-surface-containerHigh" />
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8"
                      fill="none" className="text-primary"
                      strokeDasharray={`${data.actions.completion_rate * 2.51} 251`}
                      strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-medium text-onSurface">{data.actions.completion_rate}%</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-lg font-medium text-onSurface">{data.actions.completed}</p>
                  <p className="text-xs text-onSurface-variant">Completed</p>
                </div>
                <div>
                  <p className="text-lg font-medium text-onSurface">{data.actions.by_status?.pending ?? 0}</p>
                  <p className="text-xs text-onSurface-variant">Pending</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
