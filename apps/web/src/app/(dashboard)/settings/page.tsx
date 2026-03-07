'use client';

import { useState } from 'react';
import {
  Check,
  X,
  ExternalLink,
  Mail,
  MessageSquare,
  Linkedin,
  Phone,
  Sparkles,
  Bell,
  Shield,
  Sliders,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Mock Data ──────────────────────────────────────────────────────────────

interface LinkedAccountConfig {
  provider: string;
  label: string;
  icon: React.ElementType;
  connected: boolean;
  email?: string;
  description: string;
}

const linkedAccounts: LinkedAccountConfig[] = [
  {
    provider: 'google',
    label: 'Google',
    icon: Mail,
    connected: true,
    email: 'john@company.com',
    description: 'Gmail, Calendar, Contacts',
  },
  {
    provider: 'microsoft',
    label: 'Microsoft',
    icon: Mail,
    connected: false,
    description: 'Outlook, Calendar, Teams',
  },
  {
    provider: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    connected: true,
    email: 'linkedin.com/in/johndoe',
    description: 'Profile, connections, messages',
  },
  {
    provider: 'twilio',
    label: 'Twilio',
    icon: Phone,
    connected: false,
    description: 'SMS and voice calls',
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [formality, setFormality] = useState(6);
  const [warmth, setWarmth] = useState(7);
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [autoRespond, setAutoRespond] = useState(false);
  const [autoLogMeetings, setAutoLogMeetings] = useState(true);
  const [modes, setModes] = useState({
    sales: true,
    recruit: false,
    manage: true,
  });

  const sampleEmail = `Hi Sarah,

Thanks for taking the time to review our deck. The Q4 metrics really showcase the momentum we've been building.

I'd love to set up a call next week to walk through our roadmap and discuss how Mercury could fit into your portfolio thesis.

Would Tuesday or Thursday work for you?

Best,
John`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Linked Accounts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-warm-gray-400" />
          <h2 className="text-lg font-serif font-semibold text-charcoal">
            Linked Accounts
          </h2>
        </div>
        <div className="bg-white rounded-mercury-lg border border-warm-gray-200 divide-y divide-warm-gray-100">
          {linkedAccounts.map((account) => (
            <div
              key={account.provider}
              className="flex items-center gap-4 px-5 py-4"
            >
              <div className="w-10 h-10 rounded-mercury bg-warm-gray-100 flex items-center justify-center">
                <account.icon className="w-5 h-5 text-warm-gray-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-charcoal">
                    {account.label}
                  </h3>
                  {account.connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-warm-gray-500 bg-warm-gray-100 px-2 py-0.5 rounded-full">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-warm-gray-500 mt-0.5">
                  {account.connected && account.email
                    ? account.email
                    : account.description}
                </p>
              </div>
              <button
                className={cn(
                  'px-4 py-2 text-xs font-medium rounded-mercury transition-mercury',
                  account.connected
                    ? 'text-warm-gray-500 hover:text-red-600 hover:bg-red-50 border border-warm-gray-200'
                    : 'bg-charcoal text-cream hover:bg-charcoal-400 shadow-mercury-sm',
                )}
              >
                {account.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* AI Voice */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-sienna" />
          <h2 className="text-lg font-serif font-semibold text-charcoal">
            AI Voice
          </h2>
        </div>
        <div className="bg-white rounded-mercury-lg border border-warm-gray-200 overflow-hidden">
          {/* Sample Email Preview */}
          <div className="px-5 py-4 border-b border-warm-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-charcoal">
                Sample Output
              </h3>
              <span className="text-xs text-warm-gray-400">
                Preview of AI-generated email
              </span>
            </div>
            <div className="bg-warm-gray-50 rounded-mercury p-4 text-sm text-warm-gray-700 leading-relaxed font-mono text-xs whitespace-pre-wrap">
              {sampleEmail}
            </div>
          </div>

          {/* Sliders */}
          <div className="px-5 py-5 space-y-6">
            {/* Formality */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-charcoal">
                  Formality
                </label>
                <span className="text-xs text-warm-gray-500 font-mono">
                  {formality}/10
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-warm-gray-400 w-12">Casual</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formality}
                  onChange={(e) => setFormality(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-warm-gray-200 rounded-full appearance-none cursor-pointer accent-sienna"
                />
                <span className="text-xs text-warm-gray-400 w-12 text-right">
                  Formal
                </span>
              </div>
            </div>

            {/* Warmth */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-charcoal">
                  Warmth
                </label>
                <span className="text-xs text-warm-gray-500 font-mono">
                  {warmth}/10
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-warm-gray-400 w-12">
                  Direct
                </span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-warm-gray-200 rounded-full appearance-none cursor-pointer accent-sienna"
                />
                <span className="text-xs text-warm-gray-400 w-12 text-right">
                  Warm
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Automation */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-warm-gray-400" />
          <h2 className="text-lg font-serif font-semibold text-charcoal">
            Automation
          </h2>
        </div>
        <div className="bg-white rounded-mercury-lg border border-warm-gray-200 divide-y divide-warm-gray-100">
          {/* Auto-follow-up */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-charcoal">
                Auto Follow-up
              </h3>
              <p className="text-xs text-warm-gray-500 mt-0.5">
                Automatically send follow-up emails when no response is
                received
              </p>
            </div>
            <Toggle
              enabled={autoFollowUp}
              onChange={setAutoFollowUp}
            />
          </div>

          {/* Auto-respond */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-charcoal">
                Auto Respond
              </h3>
              <p className="text-xs text-warm-gray-500 mt-0.5">
                Let AI respond to simple messages automatically (requires
                approval first)
              </p>
            </div>
            <Toggle
              enabled={autoRespond}
              onChange={setAutoRespond}
            />
          </div>

          {/* Auto-log meetings */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-charcoal">
                Auto Log Meetings
              </h3>
              <p className="text-xs text-warm-gray-500 mt-0.5">
                Automatically log calendar meetings and notes to contact
                timelines
              </p>
            </div>
            <Toggle
              enabled={autoLogMeetings}
              onChange={setAutoLogMeetings}
            />
          </div>
        </div>
      </section>

      {/* Mode Selection */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-warm-gray-400" />
          <h2 className="text-lg font-serif font-semibold text-charcoal">
            Active Modes
          </h2>
        </div>
        <div className="bg-white rounded-mercury-lg border border-warm-gray-200 p-5">
          <p className="text-sm text-warm-gray-500 mb-4">
            Select which modes Mercury should optimize for. This affects action
            priorities and AI suggestions.
          </p>
          <div className="flex items-center gap-4">
            {(['sales', 'recruit', 'manage'] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-mercury border cursor-pointer transition-mercury',
                  modes[mode]
                    ? 'border-charcoal bg-charcoal/5'
                    : 'border-warm-gray-200 hover:border-warm-gray-300',
                )}
              >
                <input
                  type="checkbox"
                  checked={modes[mode]}
                  onChange={(e) =>
                    setModes({ ...modes, [mode]: e.target.checked })
                  }
                  className="sr-only"
                />
                <div
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center',
                    modes[mode]
                      ? 'bg-charcoal border-charcoal'
                      : 'border-warm-gray-300',
                  )}
                >
                  {modes[mode] && (
                    <Check className="w-3 h-3 text-cream" />
                  )}
                </div>
                <span className="text-sm font-medium text-charcoal capitalize">
                  {mode}
                </span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-warm-gray-400" />
          <h2 className="text-lg font-serif font-semibold text-charcoal">
            Notification Preferences
          </h2>
        </div>
        <div className="bg-white rounded-mercury-lg border border-warm-gray-200 divide-y divide-warm-gray-100">
          {[
            {
              label: 'Urgent actions',
              description: 'Notify immediately for urgent items',
              enabled: true,
            },
            {
              label: 'AI draft ready',
              description: 'When AI finishes drafting a response',
              enabled: true,
            },
            {
              label: 'New prospect matched',
              description: 'When Scout finds a new ICP match',
              enabled: true,
            },
            {
              label: 'Deal status changes',
              description: 'When a pipeline deal moves stages',
              enabled: false,
            },
            {
              label: 'Daily briefing',
              description: 'Morning summary of your day',
              enabled: true,
            },
          ].map((pref) => (
            <div
              key={pref.label}
              className="flex items-center justify-between px-5 py-4"
            >
              <div>
                <h3 className="text-sm font-medium text-charcoal">
                  {pref.label}
                </h3>
                <p className="text-xs text-warm-gray-500 mt-0.5">
                  {pref.description}
                </p>
              </div>
              <Toggle enabled={pref.enabled} onChange={() => {}} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Toggle Component ───────────────────────────────────────────────────────

function Toggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
        enabled ? 'bg-charcoal' : 'bg-warm-gray-200',
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
