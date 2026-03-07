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

// --- Mock Data ---------------------------------------------------------------

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

// --- Component ---------------------------------------------------------------

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
          <Shield className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">
            Linked Accounts
          </h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
          {linkedAccounts.map((account) => (
            <div
              key={account.provider}
              className="flex items-center gap-4 px-5 py-4"
            >
              <div className="w-10 h-10 rounded-md bg-surface-containerHigh flex items-center justify-center">
                <account.icon className="w-5 h-5 text-onSurface-variant" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-onSurface">
                    {account.label}
                  </h3>
                  {account.connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Check className="w-2.5 h-2.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-onSurface-variant bg-surface-containerHigh px-2 py-0.5 rounded-full">
                      Not connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-onSurface-variant mt-0.5">
                  {account.connected && account.email
                    ? account.email
                    : account.description}
                </p>
              </div>
              <button
                className={cn(
                  'px-6 h-10 text-sm font-medium rounded-full transition-m3',
                  account.connected
                    ? 'text-onSurface-variant hover:text-error hover:bg-error/[0.08] border border-outline-variant'
                    : 'bg-primary text-onPrimary hover:shadow-elevation-1',
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
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-medium text-onSurface">
            AI Voice
          </h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
          {/* Sample Email Preview */}
          <div className="px-5 py-4 border-b border-outline-variant">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-onSurface">
                Sample Output
              </h3>
              <span className="text-xs text-onSurface-variant">
                Preview of AI-generated email
              </span>
            </div>
            <div className="bg-surface-containerLow rounded-md p-4 text-sm text-onSurface-variant leading-relaxed font-mono text-xs whitespace-pre-wrap">
              {sampleEmail}
            </div>
          </div>

          {/* Sliders */}
          <div className="px-5 py-5 space-y-6">
            {/* Formality */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-onSurface">
                  Formality
                </label>
                <span className="text-xs text-onSurface-variant font-mono">
                  {formality}/10
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-onSurface-variant w-12">Casual</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formality}
                  onChange={(e) => setFormality(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-surface-containerHigh rounded-full appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs text-onSurface-variant w-12 text-right">
                  Formal
                </span>
              </div>
            </div>

            {/* Warmth */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-onSurface">
                  Warmth
                </label>
                <span className="text-xs text-onSurface-variant font-mono">
                  {warmth}/10
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-onSurface-variant w-12">
                  Direct
                </span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value))}
                  className="flex-1 h-1.5 bg-surface-containerHigh rounded-full appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs text-onSurface-variant w-12 text-right">
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
          <Sliders className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">
            Automation
          </h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
          {/* Auto-follow-up */}
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-onSurface">
                Auto Follow-up
              </h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
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
              <h3 className="text-sm font-medium text-onSurface">
                Auto Respond
              </h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
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
              <h3 className="text-sm font-medium text-onSurface">
                Auto Log Meetings
              </h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
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
          <Sliders className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">
            Active Modes
          </h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant p-5">
          <p className="text-sm text-onSurface-variant mb-4">
            Select which modes Mercury should optimize for. This affects action
            priorities and AI suggestions.
          </p>
          <div className="flex items-center gap-4">
            {(['sales', 'recruit', 'manage'] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-m3',
                  modes[mode]
                    ? 'border-primary bg-primary/[0.08]'
                    : 'border-outline-variant hover:border-outline',
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
                      ? 'bg-primary border-primary'
                      : 'border-outline',
                  )}
                >
                  {modes[mode] && (
                    <Check className="w-3 h-3 text-onPrimary" />
                  )}
                </div>
                <span className="text-sm font-medium text-onSurface capitalize">
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
          <Bell className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">
            Notification Preferences
          </h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
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
                <h3 className="text-sm font-medium text-onSurface">
                  {pref.label}
                </h3>
                <p className="text-xs text-onSurface-variant mt-0.5">
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

// --- Toggle Component --------------------------------------------------------

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
        enabled ? 'bg-primary' : 'bg-outline-variant',
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
