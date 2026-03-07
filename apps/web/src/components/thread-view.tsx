'use client';

import { cn, formatRelativeTime } from '@/lib/utils';
import {
  Send,
  Pencil,
  RefreshCw,
  Sparkles,
  ChevronDown,
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
  contactName: string;
  subject?: string;
  onSendDraft?: () => void;
  onEditDraft?: () => void;
  onRegenerateDraft?: () => void;
}

export function ThreadView({
  messages,
  aiDraft,
  contactName,
  subject,
  onSendDraft,
  onEditDraft,
  onRegenerateDraft,
}: ThreadViewProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      {subject && (
        <div className="px-6 py-4 border-b border-warm-gray-100">
          <h2 className="text-base font-semibold text-charcoal">{subject}</h2>
          <p className="text-xs text-warm-gray-500 mt-0.5">
            Conversation with {contactName}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-mercury px-6 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[85%]',
              message.isOutbound ? 'ml-auto' : 'mr-auto',
            )}
          >
            {/* Sender info */}
            <div
              className={cn(
                'flex items-center gap-2 mb-1',
                message.isOutbound ? 'justify-end' : 'justify-start',
              )}
            >
              <span className="text-xs font-medium text-warm-gray-600">
                {message.sender}
              </span>
              <span className="text-xs text-warm-gray-400">
                {formatRelativeTime(message.timestamp)}
              </span>
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'rounded-mercury-lg px-4 py-3 text-sm leading-relaxed',
                message.isOutbound
                  ? 'bg-charcoal text-cream rounded-br-sm'
                  : 'bg-white border border-warm-gray-200 text-charcoal rounded-bl-sm',
              )}
            >
              <div className="whitespace-pre-wrap">{message.body}</div>
            </div>
          </div>
        ))}

        {/* AI Draft Ghost Message */}
        {aiDraft && (
          <div className="max-w-[85%] ml-auto">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-sienna">
                <Sparkles className="w-3 h-3" />
                AI Draft
              </span>
              <span className="text-xs text-warm-gray-400">
                {Math.round(aiDraft.confidence * 100)}% confidence
              </span>
            </div>
            <div className="ghost-message rounded-mercury-lg px-4 py-3 text-sm leading-relaxed text-charcoal/70 rounded-br-sm">
              <div className="relative z-10 whitespace-pre-wrap">
                {aiDraft.body}
              </div>
            </div>

            {/* Draft Actions */}
            <div className="flex items-center gap-2 mt-2 justify-end">
              <button
                onClick={onSendDraft}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-sienna text-white rounded-mercury hover:bg-sienna-500 transition-mercury shadow-mercury-sm"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
              <button
                onClick={onEditDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-warm-gray-600 hover:text-charcoal hover:bg-warm-gray-100 rounded-mercury transition-mercury"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                onClick={onRegenerateDraft}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-warm-gray-600 hover:text-charcoal hover:bg-warm-gray-100 rounded-mercury transition-mercury"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compose Area */}
      <div className="px-6 py-4 border-t border-warm-gray-100">
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-white border border-warm-gray-200 rounded-mercury-lg px-4 py-3 focus-within:border-warm-gray-300 focus-within:shadow-mercury-sm transition-mercury">
            <textarea
              placeholder="Type a reply..."
              rows={2}
              className="w-full text-sm bg-transparent outline-none resize-none placeholder:text-warm-gray-400 text-charcoal"
            />
          </div>
          <button className="p-3 bg-charcoal text-cream rounded-mercury hover:bg-charcoal-400 transition-mercury shadow-mercury-sm flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
