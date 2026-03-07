import React from 'react';
import { cn } from '../lib/utils';
import { getInitials } from '@mercury/shared';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  className?: string;
}

const sizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const indicatorSizeClasses: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
  xl: 'h-4 w-4',
};

export function Avatar({
  name,
  src,
  size = 'md',
  online,
  className,
}: AvatarProps) {
  const initials = getInitials(name);

  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={cn(
            'rounded-full object-cover ring-2 ring-[#FAFAF8]',
            sizeClasses[size],
          )}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-[#F0EEEB] font-medium text-[#1A1815]',
            sizeClasses[size],
          )}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-[#FAFAF8]',
            indicatorSizeClasses[size],
            online ? 'bg-emerald-500' : 'bg-gray-300',
          )}
        />
      )}
    </div>
  );
}
