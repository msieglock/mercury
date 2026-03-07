'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  MapPin,
  Building2,
  Calendar,
  MessageSquare,
  FileText,
  Video,
  Sparkles,
  ExternalLink,
  UserPlus,
  TrendingUp,
} from 'lucide-react';
import { cn, getInitials, formatRelativeTime, segmentLabel } from '@/lib/utils';

// --- Mock Data ---------------------------------------------------------------

const contact = {
  id: '1',
  fullName: 'Sarah Chen',
  firstName: 'Sarah',
  title: 'Partner',
  company: 'Sequoia Capital',
  email: 'sarah@sequoia.com',
  phone: '+1 (415) 555-0142',
  linkedinUrl: 'https://linkedin.com/in/sarachen',
  location: 'San Francisco, CA',
  segment: 'hot_lead',
  outreachPath: 'warm_intro',
  score: 92,
  avatarUrl: null,
  tags: ['Investor', 'Series A', 'FinTech'],
  notes:
    'Met at TechCrunch Disrupt. Very interested in our AI approach. Has invested in similar companies.',
};

const interactions = [
  {
    id: '1',
    type: 'email_received' as const,
    subject: 'Re: Mercury deck - Series A',
    body: 'Hi John, thanks for sending the updated deck. I had a chance to review it with my team. The Q4 metrics are impressive. Could we set up a call next week to discuss further?',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sentiment: 'positive' as const,
  },
  {
    id: '2',
    type: 'email_sent' as const,
    subject: 'Re: Mercury deck - Series A',
    body: "Hi Sarah, great to connect at Disrupt! As promised, here is our updated deck with Q4 metrics. Happy to discuss anytime.",
    timestamp: new Date(Date.now() - 172800000).toISOString(),
    sentiment: 'neutral' as const,
  },
  {
    id: '3',
    type: 'meeting' as const,
    subject: 'TechCrunch Disrupt - Coffee meeting',
    body: 'Met at the conference. Discussed Mercury vision and AI-first approach. She was particularly interested in the outreach path recommendation engine.',
    timestamp: new Date(Date.now() - 604800000).toISOString(),
    sentiment: 'positive' as const,
  },
  {
    id: '4',
    type: 'note' as const,
    subject: 'Research notes',
    body: 'Sequoia has been actively investing in AI infrastructure companies. Sarah led their investment in Anthropic and is looking for applied AI plays.',
    timestamp: new Date(Date.now() - 864000000).toISOString(),
    sentiment: 'neutral' as const,
  },
];

const insights = [
  {
    label: 'Best Time to Contact',
    value: 'Tues/Thurs, 10-11 AM PT',
  },
  {
    label: 'Response Rate',
    value: '85% within 24h',
  },
  {
    label: 'Communication Preference',
    value: 'Email (formal tone)',
  },
  {
    label: 'Deal Probability',
    value: '72% based on engagement signals',
  },
];

const enrichmentData = [
  { label: 'Company Size', value: '500+ employees' },
  { label: 'Industry', value: 'Venture Capital' },
  { label: 'Fund Size', value: '$8B AUM' },
  { label: 'Recent Investments', value: 'Anthropic, Stripe, Notion' },
  { label: 'LinkedIn Connections', value: '5,200+' },
];

const typeIcons: Record<string, React.ElementType> = {
  email_sent: Mail,
  email_received: Mail,
  meeting: Video,
  note: FileText,
  sms_sent: MessageSquare,
  sms_received: MessageSquare,
  linkedin_message: Linkedin,
  call: Phone,
};

const typeLabels: Record<string, string> = {
  email_sent: 'Email sent',
  email_received: 'Email received',
  meeting: 'Meeting',
  note: 'Note',
  sms_sent: 'SMS sent',
  sms_received: 'SMS received',
  linkedin_message: 'LinkedIn',
  call: 'Call',
};

// --- Component ---------------------------------------------------------------

export default function ContactDetailPage() {
  return (
    <div className="max-w-6xl mx-auto">
      {/* Back Link */}
      <Link
        href="/people"
        className="inline-flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to People
      </Link>

      {/* Profile Header */}
      <div className="bg-surface rounded-xl border border-outline-variant p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-semibold text-onPrimary">
              {getInitials(contact.fullName)}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-medium text-onSurface">
                  {contact.fullName}
                </h1>
                <p className="text-onSurface-variant mt-0.5">
                  {contact.title} at{' '}
                  <span className="font-medium">{contact.company}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-full',
                    'bg-primary-container text-onPrimary-container',
                  )}
                >
                  {segmentLabel(contact.segment)}
                </span>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                  Score: {contact.score}
                </span>
              </div>
            </div>

            {/* Contact Info Bar */}
            <div className="flex items-center gap-6 mt-4">
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3"
              >
                <Mail className="w-3.5 h-3.5 text-onSurface-variant" />
                {contact.email}
              </a>
              <span className="flex items-center gap-1.5 text-sm text-onSurface-variant">
                <Phone className="w-3.5 h-3.5 text-onSurface-variant" />
                {contact.phone}
              </span>
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3"
              >
                <Linkedin className="w-3.5 h-3.5 text-onSurface-variant" />
                LinkedIn
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="flex items-center gap-1.5 text-sm text-onSurface-variant">
                <MapPin className="w-3.5 h-3.5 text-onSurface-variant" />
                {contact.location}
              </span>
            </div>

            {/* Outreach Path Badge */}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-surface-containerLow rounded-md text-xs">
              <UserPlus className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium text-onSurface">
                Outreach Path: Warm Intro
              </span>
              <span className="text-onSurface-variant">
                via David Park (mutual connection)
              </span>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 mt-3">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs font-medium text-onSecondary-container bg-secondary-container rounded-lg"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-[1fr_380px] gap-6">
        {/* LEFT - Interaction Timeline */}
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant">
            <h2 className="text-sm font-medium text-onSurface">
              Interaction Timeline
            </h2>
          </div>
          <div className="p-5">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-outline-variant" />

              <div className="space-y-6">
                {interactions.map((interaction) => {
                  const Icon = typeIcons[interaction.type] || Mail;
                  const isInbound = interaction.type.includes('received');

                  return (
                    <div
                      key={interaction.id}
                      className="relative flex gap-4 group"
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          'w-[31px] h-[31px] rounded-full flex items-center justify-center flex-shrink-0 z-10',
                          isInbound
                            ? 'bg-primary-container border-2 border-primary/30'
                            : 'bg-surface-containerHigh border-2 border-outline-variant',
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-3.5 h-3.5',
                            isInbound
                              ? 'text-primary'
                              : 'text-onSurface-variant',
                          )}
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-onSurface-variant">
                            {typeLabels[interaction.type]}
                          </span>
                          <span className="text-xs text-onSurface-variant">
                            {formatRelativeTime(interaction.timestamp)}
                          </span>
                          {interaction.sentiment === 'positive' && (
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Positive
                            </span>
                          )}
                        </div>
                        {interaction.subject && (
                          <p className="text-sm font-medium text-onSurface">
                            {interaction.subject}
                          </p>
                        )}
                        <p className="text-sm text-onSurface-variant mt-1 leading-relaxed">
                          {interaction.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT - AI Insights + Enrichment */}
        <div className="space-y-6">
          {/* AI Insights */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium text-onSurface">
                AI Insights
              </h2>
            </div>
            <div className="divide-y divide-outline-variant">
              {insights.map((insight) => (
                <div key={insight.label} className="px-5 py-3">
                  <p className="text-xs font-medium text-onSurface-variant uppercase tracking-wider">
                    {insight.label}
                  </p>
                  <p className="text-sm text-onSurface mt-0.5 font-medium">
                    {insight.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship Graph Placeholder */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-onSurface-variant" />
              <h2 className="text-sm font-medium text-onSurface">
                Relationship Graph
              </h2>
            </div>
            <div className="px-5 py-8 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-surface-containerHigh flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-onSurface-variant" />
                </div>
                <p className="text-sm text-onSurface-variant">
                  Relationship graph coming soon
                </p>
                <p className="text-xs text-onSurface-variant mt-1">
                  Visualize connections and mutual contacts
                </p>
              </div>
            </div>
          </div>

          {/* Enrichment Data (Apollo) */}
          <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
              <Building2 className="w-4 h-4 text-onSurface-variant" />
              <h2 className="text-sm font-medium text-onSurface">
                Enrichment Data
              </h2>
              <span className="ml-auto text-xs text-onSurface-variant">
                via Apollo
              </span>
            </div>
            <div className="divide-y divide-outline-variant">
              {enrichmentData.map((item) => (
                <div key={item.label} className="px-5 py-3">
                  <p className="text-xs text-onSurface-variant">{item.label}</p>
                  <p className="text-sm text-onSurface mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
