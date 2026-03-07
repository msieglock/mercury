'use client';

import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const handleLogin = async (provider: 'google' | 'azure') => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="text-center py-16">
      {/* Logo */}
      <div className="flex justify-center mb-10">
        <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center shadow-elevation-2">
          <span className="text-onPrimary text-2xl font-bold">M</span>
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-medium text-onBackground tracking-tight">
        Welcome to Mercury
      </h1>
      <p className="text-onSurface-variant mt-3 text-base">
        Your AI-powered command center
      </p>

      {/* Login Buttons */}
      <div className="mt-10 space-y-3">
        <button
          onClick={() => handleLogin('google')}
          className="w-full flex items-center justify-center gap-3 px-6 h-14 bg-primary text-onPrimary rounded-full text-sm font-medium hover:shadow-elevation-2 transition-m3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#FFFFFF"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#FFFFFF"
              fillOpacity="0.8"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FFFFFF"
              fillOpacity="0.6"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#FFFFFF"
              fillOpacity="0.9"
            />
          </svg>
          Continue with Google
        </button>

        <button
          onClick={() => handleLogin('azure')}
          className="w-full flex items-center justify-center gap-3 px-6 h-14 border border-outline text-primary rounded-full text-sm font-medium hover:bg-primary/[0.08] transition-m3"
        >
          <svg className="w-5 h-5" viewBox="0 0 23 23">
            <path fill="#f35325" d="M1 1h10v10H1z" />
            <path fill="#81bc06" d="M12 1h10v10H12z" />
            <path fill="#05a6f0" d="M1 12h10v10H1z" />
            <path fill="#ffba08" d="M12 12h10v10H12z" />
          </svg>
          Continue with Microsoft
        </button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-onSurface-variant leading-relaxed">
        By continuing, you agree to Mercury&apos;s Terms of Service
        <br />
        and Privacy Policy.
      </p>
    </div>
  );
}
