'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Mail,
  MessageSquare,
  Linkedin,
  UserPlus,
  ArrowUpDown,
  ChevronRight,
} from 'lucide-react';
import { cn, getInitials, segmentLabel, formatRelativeTime } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

const segments = [
  'all',
  'hot_lead',
  'warm',
  'cold',
  'candidate',
  'connected',
  'needs_followup',
];

interface Contact {
  id: string;
  fullName: string;
  title: string;
  company: string;
  segment: string;
  outreachPath: string | null;
  score: number;
  lastContact: string;
  nextAction: string;
  email: string;
}

const outreachPathIcons: Record<
  string,
  { icon: React.ElementType; label: string }
> = {
  direct_inbox: { icon: Mail, label: 'Direct Email' },
  direct_text: { icon: MessageSquare, label: 'Text' },
  direct_linkedin: { icon: Linkedin, label: 'LinkedIn' },
  warm_intro: { icon: UserPlus, label: 'Warm Intro' },
  second_degree: { icon: UserPlus, label: '2nd Degree' },
  cold_enriched: { icon: Mail, label: 'Cold (Enriched)' },
  cold_research: { icon: Search, label: 'Cold (Research)' },
};

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-surface-containerHigh rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            score >= 80
              ? 'bg-emerald-500'
              : score >= 60
                ? 'bg-amber-400'
                : score >= 40
                  ? 'bg-orange-400'
                  : 'bg-outline',
          )}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono text-onSurface-variant w-6">
        {score}
      </span>
    </div>
  );
}

// --- Component ---

export default function PeoplePage() {
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSegment, setActiveSegment] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    apiClient('/api/contacts')
      .then((data) => {
        const raw = data.contacts || data || [];
        const mapped: Contact[] = raw.map((c: Record<string, unknown>) => ({
          id: String(c.id || ''),
          fullName: String(c.fullName || c.full_name || c.name || 'Unknown'),
          title: String(c.title || ''),
          company: String(c.company || c.company_name || ''),
          segment: String(c.segment || 'cold'),
          outreachPath: c.outreachPath || c.outreach_path ? String(c.outreachPath || c.outreach_path) : null,
          score: Number(c.score || c.relationship_score || 0),
          lastContact: String(c.lastContact || c.last_contact || c.updated_at || new Date().toISOString()),
          nextAction: String(c.nextAction || c.next_action || ''),
          email: String(c.email || ''),
        }));
        setContacts(mapped);
      })
      .catch(() => {
        setError(true);
        setContacts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="h-11 bg-surface-containerHigh rounded-full animate-pulse" />
        <div className="flex gap-2">
          {segments.slice(0, 5).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-surface-containerHigh rounded-lg animate-pulse" />
          ))}
        </div>
        <LoadingSkeleton variant="table" rows={6} />
      </div>
    );
  }

  if (error && (!contacts || contacts.length === 0)) {
    return (
      <div className="max-w-7xl mx-auto">
        <ApiErrorState />
      </div>
    );
  }

  const filteredContacts = (contacts || []).filter((c) => {
    const matchesSegment =
      activeSegment === 'all' || c.segment === activeSegment;
    const matchesSearch =
      searchQuery === '' ||
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSegment && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto">
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-onSurface-variant" />
        <input
          type="text"
          placeholder="Search contacts by name, company, or title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-surface-containerHigh border border-outline-variant rounded-full text-sm placeholder:text-onSurface-variant focus:outline-none focus:border-outline focus:shadow-elevation-1 transition-m3"
        />
      </div>

      {/* Segment Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-none pb-1">
        {segments.map((seg) => (
          <button
            key={seg}
            onClick={() => setActiveSegment(seg)}
            className={cn(
              'px-4 h-8 text-sm font-medium rounded-lg whitespace-nowrap transition-m3',
              activeSegment === seg
                ? 'bg-secondary-container text-onSecondary-container'
                : 'border border-outline text-onSurface-variant hover:bg-surface-containerHigh',
            )}
          >
            {seg === 'all' ? 'All' : segmentLabel(seg)}
          </button>
        ))}
      </div>

      {/* Contact Table */}
      <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_100px_80px_1fr_1fr_32px] gap-4 px-5 py-3 border-b border-outline-variant text-xs font-medium text-onSurface-variant uppercase tracking-wider">
          <div className="flex items-center gap-1 cursor-pointer hover:text-onSurface">
            Name <ArrowUpDown className="w-3 h-3" />
          </div>
          <div>Title</div>
          <div>Company</div>
          <div>Path</div>
          <div>Score</div>
          <div>Last Contact</div>
          <div>Next Action</div>
          <div />
        </div>

        {/* Table Body */}
        <div className="divide-y divide-outline-variant">
          {filteredContacts.map((contact) => {
            const pathInfo = contact.outreachPath
              ? outreachPathIcons[contact.outreachPath]
              : null;
            const PathIcon = pathInfo?.icon || Mail;

            return (
              <Link
                key={contact.id}
                href={`/people/${contact.id}`}
                className="grid grid-cols-[2fr_1.5fr_1fr_100px_80px_1fr_1fr_32px] gap-4 px-5 py-3.5 items-center hover:bg-surface-containerLow transition-m3 group"
              >
                {/* Name */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-onPrimary">
                      {getInitials(contact.fullName)}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-onSurface truncate">
                    {contact.fullName}
                  </span>
                </div>

                {/* Title */}
                <div className="text-sm text-onSurface-variant truncate">
                  {contact.title}
                </div>

                {/* Company */}
                <div className="text-sm text-onSurface-variant truncate">
                  {contact.company}
                </div>

                {/* Outreach Path */}
                <div className="flex items-center gap-1.5">
                  <PathIcon className="w-3.5 h-3.5 text-onSurface-variant" />
                  <span className="text-xs text-onSurface-variant truncate">
                    {pathInfo?.label || 'N/A'}
                  </span>
                </div>

                {/* Score */}
                <ScoreBar score={contact.score} />

                {/* Last Contact */}
                <div className="text-xs text-onSurface-variant">
                  {contact.lastContact
                    ? formatRelativeTime(contact.lastContact)
                    : '--'}
                </div>

                {/* Next Action */}
                <div className="text-xs text-onSurface-variant truncate">
                  {contact.nextAction || '--'}
                </div>

                {/* Chevron */}
                <div className="flex justify-end">
                  <ChevronRight className="w-4 h-4 text-outline group-hover:text-onSurface transition-m3" />
                </div>
              </Link>
            );
          })}
        </div>

        {filteredContacts.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-onSurface-variant">
            No contacts found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
