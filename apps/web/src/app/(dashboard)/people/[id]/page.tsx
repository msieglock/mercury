'use client';

export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
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
import { apiClient } from '@/lib/api';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

interface Contact {
  id: string;
  fullName: string;
  firstName: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  location: string;
  segment: string;
  outreachPath: string;
  score: number;
  tags: string[];
  notes: string;
}

interface Interaction {
  id: string;
  type: string;
  subject: string;
  body: string;
  timestamp: string;
  sentiment: string;
}

const typeIcons: Record<string, React.ElementType> = {
  email_sent: Mail,
  email_received: Mail,
  email: Mail,
  meeting: Video,
  note: FileText,
  sms_sent: MessageSquare,
  sms_received: MessageSquare,
  sms: MessageSquare,
  linkedin_message: Linkedin,
  linkedin: Linkedin,
  call: Phone,
};

const typeLabels: Record<string, string> = {
  email_sent: 'Email sent',
  email_received: 'Email received',
  email: 'Email',
  meeting: 'Meeting',
  note: 'Note',
  sms_sent: 'SMS sent',
  sms_received: 'SMS received',
  sms: 'SMS',
  linkedin_message: 'LinkedIn',
  linkedin: 'LinkedIn',
  call: 'Call',
};

// --- Component ---

export default function ContactDetailPage() {
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiClient(`/api/contacts/${contactId}`)
      .then((data) => {
        const c = data.contact || data;
        setContact({
          id: String(c.id || ''),
          fullName: String(c.fullName || c.full_name || c.name || 'Unknown'),
          firstName: String(c.firstName || c.first_name || (c.fullName || c.full_name || '').split(' ')[0] || ''),
          title: String(c.title || ''),
          company: String(c.company || c.company_name || ''),
          email: String(c.email || ''),
          phone: String(c.phone || ''),
          linkedinUrl: String(c.linkedinUrl || c.linkedin_url || ''),
          location: String(c.location || ''),
          segment: String(c.segment || 'cold'),
          outreachPath: String(c.outreachPath || c.outreach_path || ''),
          score: Number(c.score || c.relationship_score || 0),
          tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
          notes: String(c.notes || ''),
        });

        // Extract interactions if included in response
        if (c.interactions || data.interactions) {
          const raw = c.interactions || data.interactions || [];
          setInteractions(
            raw.map((i: Record<string, unknown>) => ({
              id: String(i.id || ''),
              type: String(i.type || 'email'),
              subject: String(i.subject || ''),
              body: String(i.body || i.content || ''),
              timestamp: String(i.timestamp || i.created_at || new Date().toISOString()),
              sentiment: String(i.sentiment || 'neutral'),
            })),
          );
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="h-4 w-24 bg-surface-containerHigh rounded animate-pulse mb-6" />
        <LoadingSkeleton variant="detail" rows={4} />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="max-w-6xl mx-auto">
        <Link
          href="/people"
          className="inline-flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to People
        </Link>
        <ApiErrorState message="Could not load contact details" />
      </div>
    );
  }

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
                  {contact.title}
                  {contact.company && (
                    <>
                      {' '}
                      at{' '}
                      <span className="font-medium">{contact.company}</span>
                    </>
                  )}
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
                {contact.score > 0 && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700">
                    Score: {contact.score}
                  </span>
                )}
              </div>
            </div>

            {/* Contact Info Bar */}
            <div className="flex items-center gap-6 mt-4 flex-wrap">
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <span className="flex items-center gap-1.5 text-sm text-onSurface-variant">
                  <Phone className="w-3.5 h-3.5" />
                  {contact.phone}
                </span>
              )}
              {contact.linkedinUrl && (
                <a
                  href={contact.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-onSurface-variant hover:text-onSurface transition-m3"
                >
                  <Linkedin className="w-3.5 h-3.5" />
                  LinkedIn
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {contact.location && (
                <span className="flex items-center gap-1.5 text-sm text-onSurface-variant">
                  <MapPin className="w-3.5 h-3.5" />
                  {contact.location}
                </span>
              )}
            </div>

            {/* Tags */}
            {contact.tags.length > 0 && (
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
            )}
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
            {interactions.length === 0 ? (
              <div className="text-center py-8 text-sm text-onSurface-variant">
                No interactions recorded yet
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-6 bottom-6 w-[1px] bg-outline-variant" />

                <div className="space-y-6">
                  {interactions.map((interaction) => {
                    const Icon = typeIcons[interaction.type] || Mail;
                    const isInbound =
                      interaction.type.includes('received') ||
                      (!interaction.type.includes('sent') &&
                        !interaction.type.includes('note'));

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
                              {typeLabels[interaction.type] || interaction.type}
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
            )}
          </div>
        </div>

        {/* RIGHT - Notes + Enrichment */}
        <div className="space-y-6">
          {/* Notes */}
          {contact.notes && (
            <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
              <div className="px-5 py-4 border-b border-outline-variant flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-medium text-onSurface">Notes</h2>
              </div>
              <div className="px-5 py-4">
                <p className="text-sm text-onSurface-variant leading-relaxed">
                  {contact.notes}
                </p>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  );
}
