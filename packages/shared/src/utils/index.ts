import { OutreachPath } from '../types';
import { OUTREACH_PATH_LABELS } from '../constants';

/**
 * Format a date as a human-readable relative time string.
 * e.g. "just now", "5m ago", "3h ago", "2d ago", "Mar 12"
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffSeconds < 60) {
    return 'just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Truncate a string to the given length, appending an ellipsis if truncated.
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) {
    return str;
  }
  return str.slice(0, length).trimEnd() + '\u2026';
}

/**
 * Extract initials from a full name (up to 2 characters).
 * e.g. "Jane Doe" -> "JD", "Alice" -> "A"
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Get the emoji icon for a given outreach path.
 */
export function getOutreachPathIcon(path: OutreachPath): string {
  return OUTREACH_PATH_LABELS[path]?.icon ?? '';
}

/**
 * Calculate a relationship score from 0-100 based on interaction history.
 *
 * Factors:
 * - Number of interactions (more = stronger relationship)
 * - Recency of last interaction (decay over time)
 * - Sentiment of interactions
 */
export function calculateRelationshipScore(
  interactions: number,
  lastInteraction: Date,
  sentiment: string,
): number {
  // Interaction volume factor (0-40 points, logarithmic curve)
  const volumeScore = Math.min(40, Math.log2(interactions + 1) * 10);

  // Recency factor (0-40 points, decays over 90 days)
  const daysSinceInteraction =
    (new Date().getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 40 * (1 - daysSinceInteraction / 90));

  // Sentiment factor (0-20 points)
  const sentimentScores: Record<string, number> = {
    positive: 20,
    neutral: 10,
    negative: 2,
  };
  const sentimentScore = sentimentScores[sentiment] ?? 10;

  return Math.round(Math.min(100, volumeScore + recencyScore + sentimentScore));
}

/**
 * Check if a due date has passed.
 */
export function isOverdue(dueAt: Date): boolean {
  return new Date() > dueAt;
}

/**
 * Group an array of objects by a given key.
 */
export function groupBy<T>(
  array: T[],
  key: keyof T,
): Record<string, T[]> {
  return array.reduce<Record<string, T[]>>((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {});
}
