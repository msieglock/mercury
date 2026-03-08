'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Send,
  Pencil,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Archive,
  Trash2,
  Clock,
  Loader2,
  Star,
} from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  senderEmail: string;
  body: string;
  timestamp: string;
  isOutbound: boolean;
  channel: 'email' | 'sms' | 'linkedin';
}

interface AIDraft {
  body: string;
  confidence: number;
}

interface ThreadViewProps {
  messages: Message[];
  aiDraft?: AIDraft | null;
  aiDraftLoading?: boolean;
  contactName: string;
  subject?: string;
  starred?: boolean;
  onBack?: () => void;
  onSendDraft?: (draftBody?: string) => void;
  onEditDraft?: () => void;
  onRegenerateDraft?: () => void;
  onReply?: () => void;
  onReplyAll?: () => void;
  onForward?: () => void;
  onArchive?: () => void;
  onTrash?: () => void;
  onSnooze?: () => void;
  onStar?: () => void;
}

export interface ThreadViewHandle {
  scrollDown: () => void;
  scrollUp: () => void;
  expandAll: () => void;
  collapseAll: () => void;
  focusCompose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ThreadView: any = forwardRef<ThreadViewHandle, ThreadViewProps>(
  function ThreadView(
    {
      messages,
      aiDraft,
      aiDraftLoading,
      contactName,
      subject,
      starred,
      onBack,
      onSendDraft,
      onEditDraft,
      onRegenerateDraft,
      onReply,
      onReplyAll,
      onForward,
      onArchive,
      onTrash,
      onSnooze,
      onStar,
    },
    ref,
  ) {
    const [collapsedMessages, setCollapsedMessages] = useState<Set<string>>(
      new Set(),
    );
    const [editingDraft, setEditingDraft] = useState(false);
    const [draftText, setDraftText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const composeRef = useRef<HTMLTextAreaElement>(null);

    const toggleCollapse = (id: string) => {
      setCollapsedMessages((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    useImperativeHandle(ref, () => ({
      scrollDown: () => {
        scrollRef.current?.scrollBy({ top: 300, behavior: 'smooth' });
      },
      scrollUp: () => {
        scrollRef.current?.scrollBy({ top: -300, behavior: 'smooth' });
      },
      expandAll: () => {
        setCollapsedMessages((prev) => {
          const next = new Set(prev);
          for (const m of messages) {
            next.delete(m.id); // Remove collapse
            next.add(`expanded-${m.id}`); // Add expanded marker
          }
          return next;
        });
      },
      collapseAll: () => {
        setCollapsedMessages(new Set());
      },
      focusCompose: () => {
        composeRef.current?.focus();
      },
    }));

    return (
      <div className="flex flex-col h-full">
        {/* Thread Header */}
        <div className="px-6 py-3 border-b border-outline-variant flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-lg transition-m3"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {subject && (
              <h2 className="text-sm font-medium text-onSurface truncate">
                {subject}
              </h2>
            )}
            <p className="text-xs text-onSurface-variant">
              {contactName} &middot; {messages.length} message
              {messages.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center gap-1">
            <ActionButton icon={Reply} label="Reply" hint="r" onClick={onReply} />
            <ActionButton icon={ReplyAll} label="Reply All" hint="R" onClick={onReplyAll} />
            <ActionButton icon={Forward} label="Forward" hint="f" onClick={onForward} />
            <div className="w-px h-5 bg-outline-variant mx-1" />
            <ActionButton icon={Star} label="Star" hint="s" onClick={onStar} active={starred} />
            <ActionButton icon={Archive} label="Done" hint="e" onClick={onArchive} />
            <ActionButton icon={Trash2} label="Trash" hint="#" onClick={onTrash} />
            <ActionButton icon={Clock} label="Remind Me" hint="h" onClick={onSnooze} />
          </div>
        </div>

        {/* Messages - Email-style rendering */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-m3 px-6 py-4 space-y-1">
          {messages.map((message, idx) => {
            // Collapse older messages by default (except last 2 and first)
            const shouldAutoCollapse =
              messages.length > 3 && idx > 0 && idx < messages.length - 1;
            const effectiveCollapsed =
              shouldAutoCollapse && !collapsedMessages.has(`expanded-${message.id}`)
                ? !collapsedMessages.has(message.id)
                : collapsedMessages.has(message.id);

            return (
              <div
                key={message.id}
                data-message-id={message.id}
                className="border border-outline-variant rounded-lg overflow-hidden"
              >
                {/* Message Header - always visible */}
                <button
                  onClick={() => {
                    if (shouldAutoCollapse) {
                      setCollapsedMessages((prev) => {
                        const next = new Set(prev);
                        if (next.has(message.id)) next.delete(message.id);
                        else next.add(message.id);
                        const expKey = `expanded-${message.id}`;
                        if (next.has(expKey)) next.delete(expKey);
                        else next.add(expKey);
                        return next;
                      });
                    } else {
                      toggleCollapse(message.id);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-containerLow transition-m3',
                    effectiveCollapsed && 'py-2.5',
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'rounded-full flex items-center justify-center flex-shrink-0',
                      message.isOutbound
                        ? 'bg-primary-container w-8 h-8'
                        : 'bg-primary w-8 h-8',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px] font-semibold',
                        message.isOutbound
                          ? 'text-onPrimary-container'
                          : 'text-onPrimary',
                      )}
                    >
                      {(message.sender || '?')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-onSurface">
                        {message.sender || 'Unknown'}
                      </span>
                      {message.isOutbound && (
                        <span className="text-[10px] text-onSurface-variant bg-surface-containerHigh px-1.5 py-0.5 rounded">
                          sent
                        </span>
                      )}
                    </div>
                    {effectiveCollapsed && (
                      <p className="text-xs text-onSurface-variant truncate mt-0.5">
                        {message.body.slice(0, 80)}...
                      </p>
                    )}
                  </div>

                  <span className="text-xs text-onSurface-variant flex-shrink-0">
                    {formatRelativeTime(message.timestamp)}
                  </span>
                  {effectiveCollapsed ? (
                    <ChevronDown className="w-3.5 h-3.5 text-onSurface-variant" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5 text-onSurface-variant" />
                  )}
                </button>

                {/* Message Body - collapsible */}
                {!effectiveCollapsed && (
                  <div className="px-4 pb-4 pt-1 border-t border-outline-variant/50">
                    <div className="text-sm text-onSurface leading-relaxed whitespace-pre-wrap pl-11">
                      {message.body}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Draft Loading */}
          {aiDraftLoading && (
            <div className="border border-dashed border-tertiary/30 rounded-lg px-4 py-6 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-tertiary animate-spin" />
              <span className="text-sm text-onSurface-variant">
                Generating AI draft...
              </span>
            </div>
          )}

          {/* AI Draft Ghost Message */}
          {aiDraft && !aiDraftLoading && (
            <div className="ghost-message rounded-lg overflow-hidden">
              {/* Draft header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-tertiary/10">
                <Sparkles className="w-3.5 h-3.5 text-tertiary" />
                <span className="text-xs font-medium text-tertiary">
                  AI Draft
                </span>
                <span className="text-[10px] text-onSurface-variant ml-auto">
                  {Math.round(aiDraft.confidence * 100)}% confidence
                </span>
              </div>

              {/* Draft body */}
              <div className="px-4 py-3">
                {editingDraft ? (
                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    rows={8}
                    className="w-full text-sm bg-transparent outline-none resize-none text-onSurface leading-relaxed"
                    autoFocus
                  />
                ) : (
                  <div className="relative z-10 text-sm leading-relaxed whitespace-pre-wrap text-onTertiary-container">
                    {aiDraft.body}
                  </div>
                )}
              </div>

              {/* Draft Actions */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-tertiary/10">
                <button
                  onClick={() => onSendDraft?.(editingDraft ? draftText : aiDraft.body)}
                  className="inline-flex items-center gap-1.5 px-5 h-9 text-sm font-medium bg-primary text-onPrimary rounded-full hover:shadow-elevation-1 transition-m3"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
                <button
                  onClick={() => {
                    if (editingDraft) {
                      setEditingDraft(false);
                    } else {
                      setDraftText(aiDraft.body);
                      setEditingDraft(true);
                    }
                    onEditDraft?.();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-medium text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {editingDraft ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={onRegenerateDraft}
                  className="inline-flex items-center gap-1.5 px-4 h-9 text-sm font-medium text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {/* AI unavailable notice */}
          {!aiDraft && !aiDraftLoading && messages.length > 0 && !messages[messages.length - 1]?.isOutbound && (
            <div className="border border-dashed border-outline-variant rounded-lg px-4 py-3 text-center">
              <span className="text-xs text-onSurface-variant">
                AI drafting unavailable
              </span>
            </div>
          )}
        </div>

        {/* Compose Area */}
        <div className="px-6 py-3 border-t border-outline-variant">
          <div className="flex items-end gap-3">
            <div className="flex-1 bg-surface-containerHigh border border-outline-variant rounded-lg px-4 py-2.5 focus-within:border-outline focus-within:shadow-elevation-1 transition-m3">
              <textarea
                ref={composeRef}
                placeholder="Type a reply... (r)"
                rows={2}
                className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-onSurface-variant text-onSurface"
              />
            </div>
            <button className="p-2.5 bg-primary text-onPrimary rounded-full hover:shadow-elevation-1 transition-m3 flex-shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  },
);

// --- Action Button ---

function ActionButton({
  icon: Icon,
  label,
  hint,
  onClick,
  active,
}: {
  icon: React.ElementType;
  label: string;
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label}${hint ? ` (${hint})` : ''}`}
      className={cn(
        'p-2 rounded-lg transition-m3 group relative',
        active
          ? 'text-primary bg-primary-container/50'
          : 'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
      )}
    >
      <Icon className="w-4 h-4" strokeWidth={1.5} />
    </button>
  );
}
