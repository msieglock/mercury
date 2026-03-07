'use client';

import {
  Sun,
  Zap,
  Users,
  Mail,
  Calendar,
  TrendingUp,
  Clock,
  CheckCircle2,
  BarChart3,
  Bot,
} from 'lucide-react';
import { ActionCard } from '@/components/action-card';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';
// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockActions = [
  {
    id: '1',
    type: 'reply_needed',
    title: 'Sarah Chen responded about Series A intro',
    description:
      'She mentioned she\'s interested but wants to review the deck first. Scout suggests sending the updated version with Q4 metrics.',
    priority: 'urgent',
    agentType: 'scout',
    contactName: 'Sarah Chen',
    companyName: 'Sequoia Capital',
    dueAt: new Date().toISOString(),
    primaryActionLabel: 'View & Reply',
    isOverdue: false,
  },
  {
    id: '2',
    type: 'follow_up',
    title: 'Follow up with Marcus on partnership proposal',
    description:
      'Last email was 5 days ago. Cadence recommends a gentle check-in with a case study attachment.',
    priority: 'high',
    agentType: 'cadence',
    contactName: 'Marcus Johnson',
    companyName: 'Stripe',
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    primaryActionLabel: 'Send Follow-up',
    isOverdue: false,
  },
  {
    id: '3',
    type: 'warm_intro',
    title: 'Warm intro opportunity via David Park',
    description:
      'David is connected to Lisa Wang (VP Eng at Figma). Scout found she\'s actively hiring. Perfect recruiting lead.',
    priority: 'high',
    agentType: 'scout',
    contactName: 'Lisa Wang',
    companyName: 'Figma',
    dueAt: null,
    primaryActionLabel: 'Request Intro',
    isOverdue: false,
  },
  {
    id: '4',
    type: 'meeting_prep',
    title: 'Prep for call with Acme Corp in 2 hours',
    description:
      'Analyst compiled: revenue up 23% YoY, new CTO hired in Q3, recently raised $50M Series C.',
    priority: 'medium',
    agentType: 'analyst',
    contactName: 'James Wright',
    companyName: 'Acme Corp',
    dueAt: new Date(Date.now() + 7200000).toISOString(),
    primaryActionLabel: 'View Brief',
    isOverdue: false,
  },
  {
    id: '5',
    type: 'deal_cold',
    title: 'Deal going cold: TechStart renewal',
    description:
      'No engagement for 12 days. Champion (Amy) hasn\'t opened last 2 emails. Risk score increased to 72.',
    priority: 'medium',
    agentType: 'analyst',
    contactName: 'Amy Rodriguez',
    companyName: 'TechStart',
    dueAt: null,
    primaryActionLabel: 'Re-engage',
    isOverdue: true,
  },
  {
    id: '6',
    type: 'new_prospect',
    title: 'New prospect matched your ICP',
    description:
      'Scout identified Ryan Kim, CTO at DataFlow (Series B, 120 employees). 89% ICP match. Best path: warm intro via Alex.',
    priority: 'low',
    agentType: 'scout',
    contactName: 'Ryan Kim',
    companyName: 'DataFlow',
    dueAt: null,
    primaryActionLabel: 'Review Profile',
    isOverdue: false,
  },
];

const mockMeetings = [
  {
    id: '1',
    time: '9:00 AM',
    title: 'Team standup',
    attendees: ['Alex M.', 'Sarah L.', 'James W.'],
    duration: '15 min',
  },
  {
    id: '2',
    time: '10:30 AM',
    title: 'Acme Corp - Quarterly Review',
    attendees: ['James Wright', 'Amy Rodriguez'],
    duration: '45 min',
  },
  {
    id: '3',
    time: '1:00 PM',
    title: 'Pipeline review with team',
    attendees: ['Full team'],
    duration: '30 min',
  },
  {
    id: '4',
    time: '3:00 PM',
    title: 'Lisa Wang intro call',
    attendees: ['Lisa Wang', 'David Park'],
    duration: '30 min',
  },
];

const pipelineHealth = [
  { stage: 'Discovery', count: 12, percentage: 30 },
  { stage: 'Qualified', count: 8, percentage: 20 },
  { stage: 'Proposal', count: 6, percentage: 15 },
  { stage: 'Negotiation', count: 4, percentage: 10 },
  { stage: 'Closed', count: 10, percentage: 25 },
];

const autoActions = [
  { label: 'Auto-logged 3 meetings from calendar', time: '2h ago' },
  { label: 'Enriched 5 new contacts via Apollo', time: '4h ago' },
  { label: 'Classified 12 incoming emails', time: '6h ago' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TodayPage() {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-7xl mx-auto">
      {/* Morning Briefing */}
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-semibold text-charcoal">
          {greeting}, John.
        </h2>
        <p className="text-warm-gray-500 mt-1">
          Here&apos;s your day. You have{' '}
          <span className="font-medium text-charcoal">6 actions</span> and{' '}
          <span className="font-medium text-charcoal">4 meetings</span> today.
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          <StatCard
            label="Actions Today"
            value={6}
            change="+2 from yesterday"
            changeType="neutral"
            icon={Zap}
          />
          <StatCard
            label="Contacts Engaged"
            value={28}
            change="+12% this week"
            changeType="positive"
            icon={Users}
          />
          <StatCard
            label="Emails Pending"
            value={3}
            change="2 AI drafts ready"
            changeType="neutral"
            icon={Mail}
          />
          <StatCard
            label="Pipeline Value"
            value="$2.4M"
            change="+$180K this month"
            changeType="positive"
            icon={TrendingUp}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-[1fr_380px] gap-8">
        {/* LEFT COLUMN - Action Cards */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-serif font-semibold text-charcoal">
              Action Feed
            </h3>
            <div className="flex items-center gap-2 text-xs text-warm-gray-500">
              <span>Sorted by priority</span>
            </div>
          </div>

          <div className="space-y-3">
            {mockActions.map((action) => (
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
              />
            ))}
          </div>

          {/* Auto-actions */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-warm-gray-400" />
              <h4 className="text-sm font-semibold text-warm-gray-500">
                Auto-actions
              </h4>
            </div>
            <div className="space-y-2">
              {autoActions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 bg-warm-gray-50 rounded-mercury text-sm"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="flex-1 text-warm-gray-600">
                    {action.label}
                  </span>
                  <span className="text-xs text-warm-gray-400">
                    {action.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Today's Meetings */}
          <div className="bg-white rounded-mercury-lg border border-warm-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-gray-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-warm-gray-400" />
              <h3 className="text-sm font-semibold text-charcoal">
                Today&apos;s Meetings
              </h3>
            </div>
            <div className="divide-y divide-warm-gray-100">
              {mockMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="px-5 py-3.5 hover:bg-warm-gray-50 transition-mercury cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-sienna">
                          {meeting.time}
                        </span>
                        <span className="text-xs text-warm-gray-400">
                          {meeting.duration}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-charcoal mt-0.5">
                        {meeting.title}
                      </p>
                      <p className="text-xs text-warm-gray-500 mt-0.5">
                        {meeting.attendees.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pipeline Health */}
          <div className="bg-white rounded-mercury-lg border border-warm-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-warm-gray-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-warm-gray-400" />
              <h3 className="text-sm font-semibold text-charcoal">
                Pipeline Health
              </h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              {pipelineHealth.map((stage) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-warm-gray-600">
                      {stage.stage}
                    </span>
                    <span className="text-xs text-warm-gray-400">
                      {stage.count}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-warm-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-charcoal rounded-full transition-all"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-mercury border border-warm-gray-200 p-4">
              <p className="text-xs text-warm-gray-500">Avg. Response</p>
              <p className="text-lg font-serif font-semibold text-charcoal mt-1">
                2.4h
              </p>
            </div>
            <div className="bg-white rounded-mercury border border-warm-gray-200 p-4">
              <p className="text-xs text-warm-gray-500">Win Rate</p>
              <p className="text-lg font-serif font-semibold text-charcoal mt-1">
                34%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
