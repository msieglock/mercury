'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Search, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { useUser } from '@/hooks/use-user';
import { ThreadRow, type ThreadData } from '@/components/inbox/thread-row';
import { StatusBar } from '@/components/inbox/status-bar';
import { ShortcutsOverlay } from '@/components/inbox/shortcuts-overlay';
import { ThreadView, type ThreadViewHandle } from '@/components/thread-view';
import { InboxSkeleton, ApiErrorState } from '@/components/loading-skeleton';

// --- Filter Tabs ---

const filterTabs = [
  { label: 'All', value: 'all' },
  { label: 'Needs Reply', value: 'needs_reply' },
  { label: 'AI Drafted', value: 'ai_drafted' },
  { label: 'Sent', value: 'sent' },
  { label: 'Snoozed', value: 'snoozed' },
];

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

// --- Component ---

export default function InboxPage() {
  // Data state
  const [threads, setThreads] = useState<ThreadData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // UI state
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'list' | 'thread'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());

  // Thread detail state
  const [threadMessages, setThreadMessages] = useState<Message[] | null>(null);
  const [aiDraft, setAiDraft] = useState<AIDraft | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [starredThreads, setStarredThreads] = useState<Set<string>>(new Set());

  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const threadViewRef = useRef<ThreadViewHandle>(null);

  const [syncing, setSyncing] = useState(false);
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [originalDraft, setOriginalDraft] = useState<string | null>(null);
  const { user } = useUser();

  // Undo stack
  const [undoStack, setUndoStack] = useState<Array<{ action: string; thread: ThreadData; index: number }>>([]);

  // Map raw API thread to our ThreadData shape
  function mapThread(t: Record<string, unknown>): ThreadData {
    const contact = t.contact as Record<string, unknown> | null;
    const lastMessage = t.last_message as Record<string, unknown> | null;
    return {
      id: String(t.thread_id || t.id || ''),
      contactName: String(contact?.full_name || t.contact_name || 'Unknown'),
      contactEmail: String(contact?.email || t.contact_email || ''),
      subject: String(lastMessage?.subject || t.subject || '(no subject)'),
      preview: String(lastMessage?.body || t.preview || t.snippet || ''),
      timestamp: String(t.last_activity || t.timestamp || new Date().toISOString()),
      unread: Boolean(t.has_unread ?? t.unread),
      intent: lastMessage?.sentiment ? String(lastMessage.sentiment) : null,
      hasAIDraft: false,
      contactId: contact?.id ? String(contact.id) : undefined,
    };
  }

  // Parse messages from API response
  function parseMessages(data: Record<string, unknown>): Message[] {
    return (((data.messages || data) as Record<string, unknown>[]) || []).map(
      (m: Record<string, unknown>) => {
        const contacts = m.contacts as Record<string, unknown> | null;
        const metadata = m.metadata as Record<string, unknown> | null;
        return {
          id: String(m.id || ''),
          sender: String(m.sender || contacts?.full_name || metadata?.from_name || m.from || 'Unknown'),
          senderEmail: String(m.senderEmail || contacts?.email || metadata?.from || m.from_email || ''),
          body: String(m.body || m.body_snippet || m.content || ''),
          timestamp: String(m.timestamp || m.occurred_at || m.created_at || new Date().toISOString()),
          isOutbound: m.isOutbound != null ? Boolean(m.isOutbound) : (m.direction === 'outbound'),
          channel: String(m.channel || 'email') as 'email' | 'sms' | 'linkedin',
        };
      },
    );
  }

  // Fetch threads from API
  function fetchThreads() {
    return apiClient('/api/inbox')
      .then((data) => {
        const mapped = (data.threads || []).map(mapThread);
        setThreads(mapped);
        return mapped;
      });
  }

  // --- Fetch threads, auto-sync if empty ---
  useEffect(() => {
    fetchThreads()
      .then((mapped) => {
        if (mapped.length === 0 && !syncing) {
          setSyncing(true);
          apiClient('/api/sync/email', { method: 'POST', body: '{}' })
            .then(() => fetchThreads())
            .catch(() => {})
            .finally(() => setSyncing(false));
        }
      })
      .catch(() => {
        setError(true);
        setThreads([]);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger style analysis if user doesn't have a fingerprint yet
  useEffect(() => {
    if (user && !user.hasStyleFingerprint && !analyzingStyle && !loading) {
      setAnalyzingStyle(true);
      apiClient('/api/ai/analyze-style', { method: 'POST', body: '{}' })
        .catch(() => {})
        .finally(() => setAnalyzingStyle(false));
    }
  }, [user, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Filtered threads ---
  const filteredThreads = (threads || []).filter((t) => {
    if (activeFilter !== 'all') {
      if (activeFilter === 'needs_reply' && !t.unread) return false;
      if (activeFilter === 'ai_drafted' && !t.hasAIDraft) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.contactName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= filteredThreads.length) {
      setSelectedIndex(Math.max(0, filteredThreads.length - 1));
    }
  }, [filteredThreads.length, selectedIndex]);

  // Auto-scroll selected into view
  useEffect(() => {
    if (mode !== 'list') return;
    const row = listRef.current?.querySelector(
      `[data-thread-id="${filteredThreads[selectedIndex]?.id}"]`,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, mode, filteredThreads]);

  // --- Thread actions ---
  const removeThread = useCallback(
    (actionName: string) => {
      const thread = filteredThreads[selectedIndex];
      if (!thread) return;
      setUndoStack((s) => [...s.slice(-9), { action: actionName, thread, index: selectedIndex }]);
      setThreads((prev) => (prev || []).filter((t) => t.id !== thread.id));
      if (mode === 'thread') {
        setMode('list');
        setThreadMessages(null);
        setAiDraft(null);
      }
    },
    [filteredThreads, selectedIndex, mode],
  );

  const undoLastAction = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setThreads((threads) => {
        const list = threads || [];
        const restored = [...list];
        restored.splice(Math.min(last.index, restored.length), 0, last.thread);
        return restored;
      });
      setSelectedIndex(last.index);
      return prev.slice(0, -1);
    });
  }, []);

  const toggleStar = useCallback(() => {
    const thread = filteredThreads[selectedIndex];
    if (!thread) return;
    setStarredThreads((prev) => {
      const next = new Set(prev);
      if (next.has(thread.id)) next.delete(thread.id);
      else next.add(thread.id);
      return next;
    });
  }, [filteredThreads, selectedIndex]);

  const toggleReadUnread = useCallback(() => {
    const thread = filteredThreads[selectedIndex];
    if (!thread) return;
    setThreads((prev) =>
      (prev || []).map((t) => (t.id === thread.id ? { ...t, unread: !t.unread } : t)),
    );
  }, [filteredThreads, selectedIndex]);

  const toggleSelect = useCallback(() => {
    const thread = filteredThreads[selectedIndex];
    if (!thread) return;
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(thread.id)) next.delete(thread.id);
      else next.add(thread.id);
      return next;
    });
  }, [filteredThreads, selectedIndex]);

  // --- Open thread ---
  const openThread = useCallback(
    (thread: ThreadData) => {
      setMode('thread');
      setThreadMessages(null);
      setAiDraft(null);

      apiClient(`/api/inbox/${thread.id}`)
        .then((data) => {
          const msgs = parseMessages(data);
          setThreadMessages(msgs);

          // Check if last message is inbound => generate AI draft
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg && !lastMsg.isOutbound) {
            setAiDraftLoading(true);
            apiClient('/api/ai/compose', {
              method: 'POST',
              body: JSON.stringify({
                contactId: thread.contactId || thread.id,
                type: 'follow_up',
                channel: 'email',
                goal: `Reply to: ${thread.subject}`,
              }),
            })
              .then((draft) => {
                setAiDraft({
                  body: String(draft.body || draft.content || draft.message || ''),
                  confidence: Number(draft.confidence || 0.85),
                });
              })
              .catch(() => {
                setAiDraft(null);
              })
              .finally(() => setAiDraftLoading(false));
          }
        })
        .catch(() => {
          setThreadMessages([]);
        });
    },
    [],
  );

  const goBackToList = useCallback(() => {
    setMode('list');
    setThreadMessages(null);
    setAiDraft(null);
  }, []);

  // Navigate to next/previous thread from within thread view
  const goToAdjacentThread = useCallback(
    (delta: number) => {
      const nextIdx = Math.max(0, Math.min(selectedIndex + delta, filteredThreads.length - 1));
      if (nextIdx !== selectedIndex) {
        setSelectedIndex(nextIdx);
        const thread = filteredThreads[nextIdx];
        if (thread) openThread(thread);
      }
    },
    [selectedIndex, filteredThreads, openThread],
  );

  // Regenerate AI draft helper
  const regenerateDraft = useCallback(() => {
    const thread = filteredThreads[selectedIndex];
    if (!thread) return;
    setAiDraftLoading(true);
    setAiDraft(null);
    setOriginalDraft(null);
    apiClient('/api/ai/compose', {
      method: 'POST',
      body: JSON.stringify({
        contactId: thread.contactId || thread.id,
        type: 'follow_up',
        channel: 'email',
        goal: `Reply to: ${thread.subject}`,
      }),
    })
      .then((draft) => {
        setAiDraft({
          body: String(draft.body || draft.content || draft.message || ''),
          confidence: Number(draft.confidence || 0.85),
        });
      })
      .catch(() => setAiDraft(null))
      .finally(() => setAiDraftLoading(false));
  }, [filteredThreads, selectedIndex]);

  // --- Keyboard shortcuts ---
  const listShortcuts = [
    // Navigation
    { key: 'j', action: () => setSelectedIndex((i) => Math.min(i + 1, filteredThreads.length - 1)) },
    { key: 'k', action: () => setSelectedIndex((i) => Math.max(i - 1, 0)) },
    { key: 'ArrowDown', action: () => setSelectedIndex((i) => Math.min(i + 1, filteredThreads.length - 1)) },
    { key: 'ArrowUp', action: () => setSelectedIndex((i) => Math.max(i - 1, 0)) },
    { key: 'Enter', action: () => { const t = filteredThreads[selectedIndex]; if (t) openThread(t); } },
    { key: 'o', action: () => { const t = filteredThreads[selectedIndex]; if (t) openThread(t); } },

    // Actions
    { key: 'e', action: () => removeThread('archive') },
    { key: 'E', shift: true, action: undoLastAction },  // Mark not done
    { key: '#', shift: true, action: () => removeThread('trash') },
    { key: 'h', action: () => removeThread('snooze') },
    { key: 's', action: toggleStar },
    { key: 'u', action: toggleReadUnread },
    { key: 'x', action: toggleSelect },
    { key: 'z', action: undoLastAction },
    { key: 'c', action: () => threadViewRef.current?.focusCompose() },

    // Selection extend
    { key: 'J', shift: true, action: () => { setSelectedIndex((i) => Math.min(i + 1, filteredThreads.length - 1)); toggleSelect(); } },
    { key: 'K', shift: true, action: () => { setSelectedIndex((i) => Math.max(i - 1, 0)); toggleSelect(); } },

    // Search
    { key: '/', action: () => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); } },

    // Help
    { key: '?', shift: true, action: () => setShortcutsOpen((o) => !o) },

    // Filter navigation
    { key: 'Tab', action: () => {
        const currentIdx = filterTabs.findIndex((f) => f.value === activeFilter);
        const nextIdx = (currentIdx + 1) % filterTabs.length;
        setActiveFilter(filterTabs[nextIdx].value);
        setSelectedIndex(0);
      },
    },
    { key: 'Tab', shift: true, action: () => {
        const currentIdx = filterTabs.findIndex((f) => f.value === activeFilter);
        const prevIdx = (currentIdx - 1 + filterTabs.length) % filterTabs.length;
        setActiveFilter(filterTabs[prevIdx].value);
        setSelectedIndex(0);
      },
    },
    { key: '1', action: () => { setActiveFilter(filterTabs[0]?.value || 'all'); setSelectedIndex(0); } },
    { key: '2', action: () => { setActiveFilter(filterTabs[1]?.value || 'all'); setSelectedIndex(0); } },
    { key: '3', action: () => { setActiveFilter(filterTabs[2]?.value || 'all'); setSelectedIndex(0); } },
    { key: '4', action: () => { setActiveFilter(filterTabs[3]?.value || 'all'); setSelectedIndex(0); } },
    { key: '5', action: () => { setActiveFilter(filterTabs[4]?.value || 'all'); setSelectedIndex(0); } },

    // Go-to sequences (Superhuman g+key)
    { key: 'g i', action: () => { setActiveFilter('all'); setSelectedIndex(0); } },
    { key: 'g s', action: () => { /* go to starred — filter starred threads */ } },

    // Escape
    { key: 'Escape', action: () => {
        if (searchOpen) { setSearchOpen(false); setSearchQuery(''); }
        if (shortcutsOpen) setShortcutsOpen(false);
        setSelectedThreadIds(new Set());
      },
    },
  ];

  const threadShortcuts = [
    // Back
    { key: 'Escape', action: goBackToList },
    { key: 'u', action: goBackToList },

    // Message actions
    { key: 'r', action: () => threadViewRef.current?.focusCompose() },
    { key: 'f', action: () => {} },  // Forward placeholder
    { key: 'R', shift: true, action: () => threadViewRef.current?.focusCompose() }, // Reply All

    // Thread actions
    { key: 'e', action: () => removeThread('archive') },
    { key: '#', shift: true, action: () => removeThread('trash') },
    { key: 'h', action: () => removeThread('snooze') },
    { key: 's', action: toggleStar },
    { key: 'z', action: undoLastAction },

    // Message navigation
    { key: 'n', action: () => {
        const el = scrollRef();
        if (el) {
          const msgs = el.querySelectorAll('[data-message-id]');
          const scrollTop = el.scrollTop;
          for (const msg of msgs) {
            if ((msg as HTMLElement).offsetTop > scrollTop + 10) {
              msg.scrollIntoView({ behavior: 'smooth', block: 'start' });
              break;
            }
          }
        }
      },
    },
    { key: 'p', action: () => {
        const el = scrollRef();
        if (el) {
          const msgs = Array.from(el.querySelectorAll('[data-message-id]'));
          const scrollTop = el.scrollTop;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if ((msgs[i] as HTMLElement).offsetTop < scrollTop - 10) {
              msgs[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
              break;
            }
          }
        }
      },
    },

    // Expand / collapse
    { key: 'o', action: () => threadViewRef.current?.expandAll() },
    { key: 'O', shift: true, action: () => threadViewRef.current?.expandAll() },

    // Scroll
    { key: ' ', action: () => threadViewRef.current?.scrollDown() },
    { key: ' ', shift: true, action: () => threadViewRef.current?.scrollUp() },

    // Thread navigation (j/k jump between threads)
    { key: 'j', action: () => goToAdjacentThread(1) },
    { key: 'k', action: () => goToAdjacentThread(-1) },

    // Help
    { key: '?', shift: true, action: () => setShortcutsOpen((o) => !o) },
  ];

  // Helper: get scroll container from thread view ref
  function scrollRef(): HTMLElement | null {
    // Access the scrollable div inside thread view
    const el = document.querySelector('.overflow-y-auto.scrollbar-m3');
    return el as HTMLElement | null;
  }

  useHotkeys(
    mode === 'list' ? listShortcuts : threadShortcuts,
    !shortcutsOpen,
  );

  // --- Render ---

  if (loading || syncing) {
    return (
      <div className="-m-8 h-[calc(100vh-3rem)]">
        <InboxSkeleton />
        {syncing && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center py-3 bg-primary-container text-onPrimary-container text-sm font-medium z-10">
            Syncing your Gmail inbox...
          </div>
        )}
        {analyzingStyle && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 py-3 bg-tertiary-container text-onTertiary-container text-sm font-medium z-10">
            <Sparkles className="w-4 h-4" />
            Learning your writing style...
          </div>
        )}
      </div>
    );
  }

  if (error && (!threads || threads.length === 0)) {
    return (
      <div className="-m-8 h-[calc(100vh-3rem)] flex">
        <ApiErrorState />
      </div>
    );
  }

  const selectedThread = filteredThreads[selectedIndex];

  return (
    <div className="-m-8 flex flex-col h-[calc(100vh-3rem)]">
      {mode === 'list' ? (
        /* ---- LIST VIEW ---- */
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter Tabs + Search */}
          <div className="px-4 py-2.5 border-b border-outline-variant flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-none">
              {filterTabs.map((tab, idx) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveFilter(tab.value);
                    setSelectedIndex(0);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-m3',
                    activeFilter === tab.value
                      ? 'bg-secondary-container text-onSecondary-container'
                      : 'text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh',
                  )}
                >
                  <span className="text-[10px] text-onSurface-variant mr-1 font-mono opacity-50">
                    {idx + 1}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search toggle */}
            {searchOpen ? (
              <div className="flex items-center gap-2 max-w-xs">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-onSurface-variant" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Filter threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface-containerHigh border border-outline-variant rounded-full focus:outline-none focus:border-outline transition-m3"
                  />
                </div>
                <button
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  className="p-1 text-onSurface-variant hover:text-onSurface"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                className="p-1.5 text-onSurface-variant hover:text-onSurface hover:bg-surface-containerHigh rounded-full transition-m3"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Thread List */}
          <div ref={listRef} className="flex-1 overflow-y-auto scrollbar-m3">
            {filteredThreads.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="text-center">
                  <Mail className="w-10 h-10 text-outline mx-auto mb-3" />
                  <p className="text-sm text-onSurface-variant">
                    No threads found
                  </p>
                </div>
              </div>
            ) : (
              filteredThreads.map((thread, idx) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  isSelected={idx === selectedIndex}
                  onClick={() => {
                    setSelectedIndex(idx);
                    openThread(thread);
                  }}
                />
              ))
            )}
          </div>

          {/* Undo Toast */}
          {undoStack.length > 0 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-inverse-surface text-inverse-onSurface rounded-lg shadow-elevation-2 text-sm z-20">
              <span>Thread {undoStack[undoStack.length - 1].action === 'archive' ? 'archived' : undoStack[undoStack.length - 1].action === 'trash' ? 'trashed' : 'snoozed'}</span>
              <button
                onClick={undoLastAction}
                className="font-medium text-inverse-primary hover:underline"
              >
                Undo (z)
              </button>
            </div>
          )}

          {/* Status Bar */}
          <StatusBar
            currentIndex={selectedIndex}
            totalCount={filteredThreads.length}
            mode="list"
          />
        </div>
      ) : (
        /* ---- THREAD VIEW ---- */
        <div className="flex-1 flex flex-col overflow-hidden">
          <ThreadView
            ref={threadViewRef}
            messages={threadMessages || []}
            aiDraft={aiDraft}
            aiDraftLoading={aiDraftLoading}
            contactName={selectedThread?.contactName || ''}
            subject={selectedThread?.subject}
            starred={selectedThread ? starredThreads.has(selectedThread.id) : false}
            onBack={goBackToList}
            onReply={() => threadViewRef.current?.focusCompose()}
            onReplyAll={() => threadViewRef.current?.focusCompose()}
            onForward={() => {}}
            onArchive={() => removeThread('archive')}
            onTrash={() => removeThread('trash')}
            onSnooze={() => removeThread('snooze')}
            onStar={toggleStar}
            onSendDraft={(draftBody?: string) => {
              if (!selectedThread) return;
              const bodyToSend = draftBody || aiDraft?.body;
              if (!bodyToSend) return;

              if (originalDraft && draftBody && draftBody !== originalDraft) {
                apiClient('/api/ai/update-style', {
                  method: 'POST',
                  body: JSON.stringify({
                    originalDraft,
                    editedVersion: draftBody,
                  }),
                }).catch(() => {});
              }

              apiClient(`/api/inbox/${selectedThread.id}/reply`, {
                method: 'POST',
                body: JSON.stringify({ body: bodyToSend }),
              })
                .then(() => {
                  setAiDraft(null);
                  setOriginalDraft(null);
                  apiClient(`/api/inbox/${selectedThread.id}`)
                    .then((data) => setThreadMessages(parseMessages(data)))
                    .catch(() => {});
                })
                .catch(() => {});
            }}
            onEditDraft={() => {
              if (aiDraft && !originalDraft) {
                setOriginalDraft(aiDraft.body);
              }
            }}
            onRegenerateDraft={regenerateDraft}
          />
          <StatusBar
            currentIndex={selectedIndex}
            totalCount={filteredThreads.length}
            mode="thread"
          />
        </div>
      )}

      {/* Shortcuts Overlay */}
      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
