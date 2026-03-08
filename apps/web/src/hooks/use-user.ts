'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  hasStyleFingerprint: boolean;
  mode: string | null;
  pipelineValue: number;
  unreadNotifications: number;
}

let cachedUser: UserProfile | null = null;

export function useUser() {
  const [user, setUser] = useState<UserProfile | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    if (cachedUser) return;

    apiClient('/api/me')
      .then((data) => {
        const u = data.user || data;
        const profile: UserProfile = {
          id: String(u.id || ''),
          email: String(u.email || ''),
          full_name: String(u.full_name || u.fullName || ''),
          avatar_url: u.avatar_url || u.avatarUrl || null,
          hasStyleFingerprint: Boolean(u.hasStyleFingerprint),
          mode: u.mode || null,
          pipelineValue: Number(u.pipelineValue || 0),
          unreadNotifications: Number(u.unreadNotifications || 0),
        };
        cachedUser = profile;
        setUser(profile);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}
