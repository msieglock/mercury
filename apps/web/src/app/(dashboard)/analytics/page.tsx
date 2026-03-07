'use client';

import {
  TrendingUp,
  TrendingDown,
  Users,
  Mail,
  Clock,
  Target,
  BarChart3,
  Activity,
} from 'lucide-react';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';

// --- Mock Data ---------------------------------------------------------------

const weeklyActivity = [
  { day: 'Mon', emails: 12, meetings: 3, actions: 8 },
  { day: 'Tue', emails: 18, meetings: 2, actions: 12 },
  { day: 'Wed', emails: 8, meetings: 5, actions: 6 },
  { day: 'Thu', emails: 22, meetings: 4, actions: 15 },
  { day: 'Fri', emails: 14, meetings: 1, actions: 9 },
  { day: 'Sat', emails: 3, meetings: 0, actions: 2 },
  { day: 'Sun', emails: 1, meetings: 0, actions: 1 },
];

const topContacts = [
  { name: 'Sarah Chen', company: 'Sequoia Capital', interactions: 24, trend: 'up' as const },
  { name: 'Marcus Johnson', company: 'Stripe', interactions: 18, trend: 'up' as const },
  { name: 'James Wright', company: 'Acme Corp', interactions: 15, trend: 'down' as const },
  { name: 'Lisa Wang', company: 'Figma', interactions: 12, trend: 'up' as const },
  { name: 'David Park', company: 'NexGen AI', interactions: 10, trend: 'up' as const },
];

const agentPerformance = [
  { agent: 'Scout', tasksCompleted: 45, accuracy: 94, tokensUsed: '12.3K' },
  { agent: 'Composer', tasksCompleted: 32, accuracy: 89, tokensUsed: '28.1K' },
  { agent: 'Cadence', tasksCompleted: 28, accuracy: 92, tokensUsed: '5.7K' },
  { agent: 'Analyst', tasksCompleted: 18, accuracy: 96, tokensUsed: '15.4K' },
];

const maxEmails = Math.max(...weeklyActivity.map((d) => d.emails));

// --- Component ---------------------------------------------------------------

export default function AnalyticsPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Outreach"
          value={156}
          change="+23% vs last week"
          changeType="positive"
          icon={Mail}
        />
        <StatCard
          label="Response Rate"
          value="42%"
          change="+5% vs last week"
          changeType="positive"
          icon={Target}
        />
        <StatCard
          label="Avg Response Time"
          value="2.4h"
          change="-18% vs last week"
          changeType="positive"
          icon={Clock}
        />
        <StatCard
          label="Active Contacts"
          value={89}
          change="+12 this week"
          changeType="positive"
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
              <h3 className="text-sm font-medium text-onSurface">
                Weekly Activity
              </h3>
            </div>
            <div className="px-5 py-6">
              {/* Simple bar chart */}
              <div className="flex items-end gap-3 h-40">
                {weeklyActivity.map((day) => (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col gap-1 items-center">
                      <div
                        className="w-full bg-primary/80 rounded-t transition-all"
                        style={{
                          height: `${(day.emails / maxEmails) * 120}px`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-onSurface-variant mt-2">
                      {day.day}
                    </span>
                    <span className="text-[10px] text-onSurface-variant">
                      {day.emails}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-4 text-xs text-onSurface-variant">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary/80" />
                  Emails sent
                </span>
              </div>
            </div>
          </div>

          {/* Agent Performance */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">
                AI Agent Performance
              </h3>
            </div>
            <div className="divide-y divide-outline-variant">
              <div className="grid grid-cols-4 px-5 py-2.5 text-xs font-medium text-onSurface-variant uppercase tracking-wider">
                <div>Agent</div>
                <div>Tasks</div>
                <div>Accuracy</div>
                <div>Tokens</div>
              </div>
              {agentPerformance.map((agent) => (
                <div
                  key={agent.agent}
                  className="grid grid-cols-4 px-5 py-3.5 items-center"
                >
                  <div className="text-sm font-medium text-onSurface">
                    {agent.agent}
                  </div>
                  <div className="text-sm text-onSurface-variant">
                    {agent.tasksCompleted}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-surface-containerHigh rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${agent.accuracy}%` }}
                      />
                    </div>
                    <span className="text-xs text-onSurface-variant">
                      {agent.accuracy}%
                    </span>
                  </div>
                  <div className="text-sm text-onSurface-variant">
                    {agent.tokensUsed}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          {/* Top Contacts */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Users className="w-4 h-4 text-onSurface-variant" />
              <h3 className="text-sm font-medium text-onSurface">
                Most Active Contacts
              </h3>
            </div>
            <div className="divide-y divide-outline-variant">
              {topContacts.map((contact, i) => (
                <div
                  key={contact.name}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-surface-containerLow transition-m3 cursor-pointer"
                >
                  <span className="text-xs font-mono text-onSurface-variant w-4">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-onSurface truncate">
                      {contact.name}
                    </p>
                    <p className="text-xs text-onSurface-variant truncate">
                      {contact.company}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono text-onSurface-variant">
                      {contact.interactions}
                    </span>
                    {contact.trend === 'up' ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-error" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Insights */}
          <div className="bg-surface rounded-xl border border-outline-variant p-5">
            <h3 className="text-sm font-medium text-onSurface mb-4">
              This Week&apos;s Insights
            </h3>
            <div className="space-y-3">
              {[
                'Best engagement day: Thursday (22 emails, 15 actions)',
                'Response rate improved by 5% after voice calibration',
                'Scout identified 8 new ICP matches this week',
                'Average deal velocity: 23 days (down from 28)',
              ].map((insight, i) => (
                <p key={i} className="text-sm text-onSurface-variant leading-relaxed flex items-start gap-2">
                  <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                  {insight}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
