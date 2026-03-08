'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Check,
  Mail,
  Linkedin,
  Phone,
  Sparkles,
  Bell,
  Shield,
  Sliders,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { LoadingSkeleton, ApiErrorState } from '@/components/loading-skeleton';

interface LinkedAccount {
  id: string;
  provider: string;
  provider_uid: string;
  connected: boolean;
  connected_at: string;
}

interface SettingsData {
  mode: string;
  formality: number;
  warmth: number;
  auto_follow_up: boolean;
  auto_respond: boolean;
  auto_log_meetings: boolean;
  notification_prefs: Record<string, boolean>;
  timezone: string;
  icp: string | null;
  linked_accounts: LinkedAccount[];
}

const providerConfig: Record<string, { label: string; icon: React.ElementType; description: string }> = {
  google: { label: 'Google', icon: Mail, description: 'Gmail, Calendar, Contacts' },
  microsoft: { label: 'Microsoft', icon: Mail, description: 'Outlook, Calendar, Teams' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, description: 'Profile, connections, messages' },
  twilio: { label: 'Twilio', icon: Phone, description: 'SMS and voice calls' },
};

const allProviders = ['google', 'microsoft', 'linkedin'];

const notifOptions = [
  { key: 'urgent_actions', label: 'Urgent actions', description: 'Notify immediately for urgent items' },
  { key: 'ai_draft_ready', label: 'AI draft ready', description: 'When AI finishes drafting a response' },
  { key: 'new_prospect', label: 'New prospect matched', description: 'When Scout finds a new ICP match' },
  { key: 'deal_status', label: 'Deal status changes', description: 'When a pipeline deal moves stages' },
  { key: 'daily_briefing', label: 'Daily briefing', description: 'Morning summary of your day' },
];

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient('/api/settings')
      .then((d) => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiClient('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setData((prev) => prev ? { ...prev, ...patch } as SettingsData : prev);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleConnect = useCallback((provider: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';
    window.location.href = `${apiUrl}/auth/${provider}`;
  }, []);

  const handleDisconnect = useCallback(async (provider: string) => {
    try {
      await apiClient(`/api/settings/accounts/${provider}`, { method: 'DELETE' });
      setData((prev) => prev ? {
        ...prev,
        linked_accounts: prev.linked_accounts.filter((a) => a.provider !== provider),
      } : prev);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <LoadingSkeleton variant="cards" />
        <LoadingSkeleton variant="list" rows={5} />
      </div>
    );
  }

  if (error || !data) {
    return <div className="max-w-3xl mx-auto"><ApiErrorState /></div>;
  }

  const connectedProviders = new Set(data.linked_accounts.map((a) => a.provider));

  const sampleEmail = `Hi Sarah,

Thanks for taking the time to review our deck. The Q4 metrics really showcase the momentum we've been building.

I'd love to set up a call next week to walk through our roadmap and discuss how Mercury could fit into your portfolio thesis.

Would Tuesday or Thursday work for you?

Best,
John`;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Save indicator */}
      {saving && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-surface-containerHigh text-onSurface text-sm px-4 py-2 rounded-full shadow-elevation-2 border border-outline-variant">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Saving...
        </div>
      )}

      {/* Linked Accounts */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">Linked Accounts</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
          {allProviders.map((provider) => {
            const config = providerConfig[provider];
            const account = data.linked_accounts.find((a) => a.provider === provider);
            const connected = !!account;

            return (
              <div key={provider} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 rounded-md bg-surface-containerHigh flex items-center justify-center">
                  <config.icon className="w-5 h-5 text-onSurface-variant" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-onSurface">{config.label}</h3>
                    {connected ? (
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
                    {connected && account.provider_uid ? account.provider_uid : config.description}
                  </p>
                </div>
                <button
                  onClick={() => connected ? handleDisconnect(provider) : handleConnect(provider)}
                  className={cn(
                    'px-6 h-10 text-sm font-medium rounded-full transition-m3',
                    connected
                      ? 'text-onSurface-variant hover:text-error hover:bg-error/[0.08] border border-outline-variant'
                      : 'bg-primary text-onPrimary hover:shadow-elevation-1',
                  )}
                >
                  {connected ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* AI Voice */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-medium text-onSurface">AI Voice</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-onSurface">Sample Output</h3>
              <span className="text-xs text-onSurface-variant">Preview of AI-generated email</span>
            </div>
            <div className="bg-surface-containerLow rounded-md p-4 text-sm text-onSurface-variant leading-relaxed font-mono text-xs whitespace-pre-wrap">
              {sampleEmail}
            </div>
          </div>
          <div className="px-5 py-5 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-onSurface">Formality</label>
                <span className="text-xs text-onSurface-variant font-mono">{data.formality}/10</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-onSurface-variant w-12">Casual</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={data.formality}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setData((prev) => prev ? { ...prev, formality: v } : prev);
                  }}
                  onMouseUp={() => save({ formality: data.formality })}
                  onTouchEnd={() => save({ formality: data.formality })}
                  className="flex-1 h-1.5 bg-surface-containerHigh rounded-full appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs text-onSurface-variant w-12 text-right">Formal</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-onSurface">Warmth</label>
                <span className="text-xs text-onSurface-variant font-mono">{data.warmth}/10</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-onSurface-variant w-12">Direct</span>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={data.warmth}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setData((prev) => prev ? { ...prev, warmth: v } : prev);
                  }}
                  onMouseUp={() => save({ warmth: data.warmth })}
                  onTouchEnd={() => save({ warmth: data.warmth })}
                  className="flex-1 h-1.5 bg-surface-containerHigh rounded-full appearance-none cursor-pointer accent-primary"
                />
                <span className="text-xs text-onSurface-variant w-12 text-right">Warm</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Automation */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">Automation</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-onSurface">Auto Follow-up</h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
                Automatically send follow-up emails when no response is received
              </p>
            </div>
            <Toggle
              enabled={data.auto_follow_up}
              onChange={(v) => {
                setData((prev) => prev ? { ...prev, auto_follow_up: v } : prev);
                save({ auto_follow_up: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-onSurface">Auto Respond</h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
                Let AI respond to simple messages automatically (requires approval first)
              </p>
            </div>
            <Toggle
              enabled={data.auto_respond}
              onChange={(v) => {
                setData((prev) => prev ? { ...prev, auto_respond: v } : prev);
                save({ auto_respond: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-medium text-onSurface">Auto Log Meetings</h3>
              <p className="text-xs text-onSurface-variant mt-0.5">
                Automatically log calendar meetings and notes to contact timelines
              </p>
            </div>
            <Toggle
              enabled={data.auto_log_meetings}
              onChange={(v) => {
                setData((prev) => prev ? { ...prev, auto_log_meetings: v } : prev);
                save({ auto_log_meetings: v });
              }}
            />
          </div>
        </div>
      </section>

      {/* Mode Selection */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sliders className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">Active Mode</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant p-5">
          <p className="text-sm text-onSurface-variant mb-4">
            Select which mode Mercury should optimize for. This affects action priorities and AI suggestions.
          </p>
          <div className="flex items-center gap-4">
            {(['sales', 'recruit', 'manage'] as const).map((mode) => (
              <label
                key={mode}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 rounded-md border cursor-pointer transition-m3',
                  data.mode === mode
                    ? 'border-primary bg-primary/[0.08]'
                    : 'border-outline-variant hover:border-outline',
                )}
                onClick={() => {
                  setData((prev) => prev ? { ...prev, mode } : prev);
                  save({ mode });
                }}
              >
                <div
                  className={cn(
                    'w-4 h-4 rounded-full border flex items-center justify-center',
                    data.mode === mode ? 'bg-primary border-primary' : 'border-outline',
                  )}
                >
                  {data.mode === mode && <Check className="w-3 h-3 text-onPrimary" />}
                </div>
                <span className="text-sm font-medium text-onSurface capitalize">{mode}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Notification Preferences */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 text-onSurface-variant" />
          <h2 className="text-lg font-medium text-onSurface">Notification Preferences</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant divide-y divide-outline-variant">
          {notifOptions.map((pref) => (
            <div key={pref.key} className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-sm font-medium text-onSurface">{pref.label}</h3>
                <p className="text-xs text-onSurface-variant mt-0.5">{pref.description}</p>
              </div>
              <Toggle
                enabled={data.notification_prefs[pref.key] ?? true}
                onChange={(v) => {
                  const updated = { ...data.notification_prefs, [pref.key]: v };
                  setData((prev) => prev ? { ...prev, notification_prefs: updated } : prev);
                  save({ notification_prefs: updated });
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ICP */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-medium text-onSurface">Ideal Customer Profile</h2>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant p-5">
          <p className="text-sm text-onSurface-variant mb-3">
            Describe your ideal customer. This helps AI prioritize leads and tailor outreach.
          </p>
          <textarea
            value={data.icp || ''}
            onChange={(e) => setData((prev) => prev ? { ...prev, icp: e.target.value } : prev)}
            onBlur={() => save({ icp: data.icp || '' })}
            placeholder="e.g., Series A-C SaaS companies, 50-200 employees, based in US/EU, using Salesforce..."
            className="w-full h-24 bg-surface-containerLow rounded-md border border-outline-variant px-4 py-3 text-sm text-onSurface placeholder:text-onSurface-variant/50 resize-none outline-none focus:border-primary transition-m3"
          />
        </div>
      </section>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
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
