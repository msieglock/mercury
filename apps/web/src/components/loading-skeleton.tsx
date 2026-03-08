'use client';

import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  variant?: 'list' | 'cards' | 'table' | 'detail';
  rows?: number;
}

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-surface-containerHigh rounded animate-pulse',
        className,
      )}
    />
  );
}

export function LoadingSkeleton({ variant = 'list', rows = 5 }: LoadingSkeletonProps) {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-surface rounded-xl border border-outline-variant p-5 space-y-3"
          >
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-8 w-16" />
            <ShimmerBar className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant">
          <ShimmerBar className="h-3 w-full" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="px-5 py-4 border-b border-outline-variant flex items-center gap-4"
          >
            <ShimmerBar className="w-8 h-8 rounded-full flex-shrink-0" />
            <ShimmerBar className="h-3 flex-1" />
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-6">
        <div className="bg-surface rounded-xl border border-outline-variant p-6 flex items-start gap-5">
          <ShimmerBar className="w-16 h-16 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <ShimmerBar className="h-6 w-48" />
            <ShimmerBar className="h-4 w-64" />
            <ShimmerBar className="h-3 w-96" />
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-outline-variant p-5 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <ShimmerBar className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <ShimmerBar className="h-3 w-32" />
                <ShimmerBar className="h-3 w-full" />
                <ShimmerBar className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default: list variant
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-surface rounded-xl border border-outline-variant p-5 flex items-start gap-4"
        >
          <ShimmerBar className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerBar className="h-4 w-40" />
            <ShimmerBar className="h-3 w-full" />
            <ShimmerBar className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className="h-full">
      {/* Filter bar skeleton */}
      <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBar key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      {/* Thread rows skeleton */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="px-5 py-3.5 border-b border-outline-variant flex items-start gap-3"
        >
          <ShimmerBar className="w-9 h-9 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <ShimmerBar className="h-3 w-32" />
            <ShimmerBar className="h-3 w-full" />
            <ShimmerBar className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ApiErrorState({ message }: { message?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div className="text-center max-w-sm">
        <div className="w-12 h-12 rounded-full bg-surface-containerHigh flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">!</span>
        </div>
        <p className="text-sm text-onSurface-variant mb-2">
          {message || 'Could not load data'}
        </p>
        <p className="text-xs text-onSurface-variant">
          Start the API server with{' '}
          <code className="px-1.5 py-0.5 bg-surface-containerHigh rounded text-xs font-mono">
            npm run dev:api
          </code>
        </p>
      </div>
    </div>
  );
}
