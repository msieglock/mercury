'use client';

import { useState } from 'react';
import {
  Mail,
  Clock,
  Sparkles,
  Send,
  Filter,
  ArchiveX,
  ChevronRight,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { ThreadView } from '@/components/thread-view';

// --- Mock Data ---------------------------------------------------------------

const filterTabs = [
  { label: 'All', value: 'all', count: 12 },
  { label: 'Needs Reply', value: 'needs_reply', count: 3 },
  { label: 'AI Drafted', value: 'ai_drafted', count: 2 },
  { label: 'Sent', value: 'sent', count: 5 },
  { label: 'Snoozed', value: 'snoozed', count: 2 },
];

interface Thread {
  id: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  preview: string;
  timestamp: string;
  unread: boolean;
  intent: string | null;
  hasAIDraft: boolean;
  filter: string;
}

const mockThreads: Thread[] = [
  {
    id: '1',
    contactName: 'Sarah Chen',
    contactEmail: 'sarah@sequoia.com',
    subject: 'Re: Mercury deck - Series A',
    preview:
      'Hi John, thanks for sending the updated deck. I had a chance to review it with my team...',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    unread: true,
    intent: 'interested',
    hasAIDraft: true,
    filter: 'needs_reply',
  },
  {
    id: '2',
    contactName: 'Marcus Johnson',
    contactEmail: 'marcus@stripe.com',
    subject: 'Partnership proposal - follow up',
    preview:
      'Hey John, wanted to circle back on the partnership proposal we discussed...',
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    unread: true,
    intent: 'question',
    hasAIDraft: true,
    filter: 'needs_reply',
  },
  {
    id: '3',
    contactName: 'Elena Vasquez',
    contactEmail: 'elena@notion.so',
    subject: 'Introduction from Alex',
    preview:
      'Hi John, Alex mentioned you are working on something interesting in the relationship management space...',
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    unread: true,
    intent: 'interested',
    hasAIDraft: false,
    filter: 'needs_reply',
  },
  {
    id: '4',
    contactName: 'James Wright',
    contactEmail: 'james@acme.com',
    subject: 'Quarterly review agenda',
    preview:
      'Looking forward to our call tomorrow. Here are some topics I wanted to cover...',
    timestamp: new Date(Date.now() - 259200000).toISOString(),
    unread: false,
    intent: null,
    hasAIDraft: false,
    filter: 'all',
  },
  {
    id: '5',
    contactName: 'Amy Rodriguez',
    contactEmail: 'amy@techstart.com',
    subject: 'Re: Contract renewal discussion',
    preview:
      'Thanks for the updated terms. We need a bit more time to review internally...',
    timestamp: new Date(Date.now() - 518400000).toISOString(),
    unread: false,
    intent: 'not_now',
    hasAIDraft: false,
    filter: 'snoozed',
  },
];

const intentBadgeColors: Record<string, string> = {
  interested: 'bg-emerald-50 text-emerald-700',
  question: 'bg-blue-50 text-blue-700',
  objection: 'bg-amber-50 text-amber-700',
  not_now: 'bg-surface-containerHigh text-onSurface-variant',
  referral: 'bg-purple-50 text-purple-700',
  ooo: 'bg-surface-containerHigh text-onSurface-variant',
};

const mockMessages = [
  {
    id: '1',
    sender: 'Sarah Chen',
    senderEmail: 'sarah@sequoia.com',
    body: 'Hi John,\n\nThanks for sending the updated deck. I had a chance to review it with my team and the Q4 metrics are impressive.\n\nCould we set up a call next week to discuss the Series A further? I have a few questions about your go-to-market strategy and the AI agent architecture.\n\nBest,\nSarah',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    isOutbound: false,
    channel: 'email' as const,
  },
  {
    id: '2',
    sender: 'You',
    senderEmail: 'john@mercury.com',
    body: "Hi Sarah,\n\nGreat to connect at Disrupt! As promised, here is our updated deck with Q4 metrics.\n\nThe key highlights:\n- 340% revenue growth QoQ\n- 94% retention rate\n- 2,400 active users\n\nHappy to discuss anytime. Looking forward to your thoughts.\n\nBest,\nJohn",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    isOutbound: true,
    channel: 'email' as const,
  },
];

const mockAIDraft = {
  body: "Hi Sarah,\n\nThat's great to hear! I'd love to set up a call next week.\n\nI have availability on Tuesday or Thursday, 10 AM - 12 PM PT. Would either of those work for you?\n\nHappy to walk through our GTM strategy in detail and dive deeper into the agent architecture. I can also share some recent case studies that demonstrate the platform's impact.\n\nLooking forward to it.\n\nBest,\nJohn",
  confidence: 0.91,
};

// --- Component ---------------------------------------------------------------

export default function InboxPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(
    mockThreads[0],
  );

  const filteredThreads = mockThreads.filter(
    (t) => activeFilter === 'all' || t.filter === activeFilter,
  );

  return (
    <div className="max-w-7xl mx-auto -mt-2">
      <div className="grid grid-cols-[380px_1fr] gap-0 bg-surface rounded-xl border border-outline-variant overflow-hidden h-[calc(100vh-10rem)]">
        {/* LEFT PANE - Thread List */}
        <div className="border-r border-outline-variant flex flex-col">
          {/* Filter Tabs */}
          <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-1 overflow-x-auto scrollbar-none">
            {filterTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-m3',
                  activeFilter === tab.value
                    ? 'bg-secondary-container text-onSecondary-container'
                    : 'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
                )}
              >
                {tab.label}
                <span className="ml-1 opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto scrollbar-m3">
            {filteredThreads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={cn(
                  'w-full text-left px-4 py-3.5 border-b border-outline-variant transition-m3',
                  selectedThread?.id === thread.id
                    ? 'bg-secondary-container/30'
                    : 'hover:bg-surface-containerLow',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Unread indicator */}
                  <div className="pt-1.5 flex-shrink-0">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        thread.unread ? 'bg-primary' : 'bg-transparent',
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm truncate',
                          thread.unread
                            ? 'font-medium text-onSurface'
                            : 'font-normal text-onSurface-variant',
                        )}
                      >
                        {thread.contactName}
                      </span>
                      <span className="text-xs text-onSurface-variant flex-shrink-0">
                        {formatRelativeTime(thread.timestamp)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-sm truncate mt-0.5',
                        thread.unread
                          ? 'text-onSurface'
                          : 'text-onSurface-variant',
                      )}
                    >
                      {thread.subject}
                    </p>
                    <p className="text-xs text-onSurface-variant truncate mt-0.5">
                      {thread.preview}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {thread.intent && (
                        <span
                          className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded capitalize',
                            intentBadgeColors[thread.intent] ||
                              'bg-surface-containerHigh text-onSurface-variant',
                          )}
                        >
                          {thread.intent.replace('_', ' ')}
                        </span>
                      )}
                      {thread.hasAIDraft && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-tertiary-container text-onTertiary-container">
                          <Sparkles className="w-2.5 h-2.5" />
                          AI Draft
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT PANE - Thread Detail */}
        <div className="flex flex-col">
          {selectedThread ? (
            <ThreadView
              messages={mockMessages}
              aiDraft={selectedThread.hasAIDraft ? mockAIDraft : null}
              contactName={selectedThread.contactName}
              subject={selectedThread.subject}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="w-10 h-10 text-outline mx-auto mb-3" />
                <p className="text-sm text-onSurface-variant">
                  Select a conversation to view
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
