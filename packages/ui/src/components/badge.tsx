import React from 'react';
import { cn } from '../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-secondary-container text-onSecondary-container',
  accent: 'bg-primary-container text-onPrimary-container',
  success: 'bg-tertiary-container text-onTertiary-container',
  warning: 'bg-tertiary-container text-onTertiary-container',
  danger: 'bg-error-container text-onError-container',
  info: 'bg-primary-container text-onPrimary-container',
  outline: 'bg-transparent border border-outline text-onSurface-variant',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
