'use client';

export const runtime = 'edge';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      // Set the session cookie on this domain
      document.cookie = `mercury_session=${token}; path=/; max-age=${30 * 24 * 60 * 60}; secure; samesite=lax`;
      router.replace('/today');
    } else {
      router.replace('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-onPrimary text-sm font-bold">M</span>
        </div>
        <p className="text-sm text-onSurface-variant">Signing you in...</p>
      </div>
    </div>
  );
}
