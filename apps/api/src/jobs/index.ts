import { Queue, type ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

// ─── Redis Connection ───────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let _redis: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!_redis) {
    _redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _redis;
}

export function getConnectionOptions(): ConnectionOptions {
  return {
    host: new URL(REDIS_URL).hostname,
    port: parseInt(new URL(REDIS_URL).port || '6379', 10),
    password: new URL(REDIS_URL).password || undefined,
  };
}

// ─── Queue Names ────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL_SYNC: 'emailSync',
  ENRICHMENT: 'enrichment',
  FOLLOW_UP_SCANNER: 'followUpScanner',
  DEAL_SCORING: 'dealScoring',
  MEETING_PREP: 'meetingPrep',
} as const;

// ─── Queues ─────────────────────────────────────────────────────────────────

let _queues: Record<string, Queue> | null = null;

function getQueues(): Record<string, Queue> {
  if (!_queues) {
    const connection = getConnectionOptions();

    _queues = {
      [QUEUE_NAMES.EMAIL_SYNC]: new Queue(QUEUE_NAMES.EMAIL_SYNC, { connection }),
      [QUEUE_NAMES.ENRICHMENT]: new Queue(QUEUE_NAMES.ENRICHMENT, { connection }),
      [QUEUE_NAMES.FOLLOW_UP_SCANNER]: new Queue(QUEUE_NAMES.FOLLOW_UP_SCANNER, { connection }),
      [QUEUE_NAMES.DEAL_SCORING]: new Queue(QUEUE_NAMES.DEAL_SCORING, { connection }),
      [QUEUE_NAMES.MEETING_PREP]: new Queue(QUEUE_NAMES.MEETING_PREP, { connection }),
    };
  }
  return _queues;
}

// ─── Job Data Types ─────────────────────────────────────────────────────────

export interface EmailSyncJobData {
  userId: string;
  fullHistory?: boolean;
  since?: string;
}

export interface EnrichmentJobData {
  userId: string;
  contactIds?: string[];
  source?: string;
}

export interface FollowUpScannerJobData {
  userId: string;
}

export interface DealScoringJobData {
  userId: string;
  pipelineId?: string;
}

export interface MeetingPrepJobData {
  userId: string;
  eventId?: string;
}

// ─── Job Addition Functions ─────────────────────────────────────────────────

/**
 * Enqueue an email sync job.
 */
export async function addEmailSyncJob(data: EmailSyncJobData): Promise<string> {
  const queues = getQueues();
  const job = await queues[QUEUE_NAMES.EMAIL_SYNC].add('sync', data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueue a contact enrichment job.
 */
export async function addEnrichmentJob(data: EnrichmentJobData): Promise<string> {
  const queues = getQueues();
  const job = await queues[QUEUE_NAMES.ENRICHMENT].add('enrich', data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueue a follow-up scanner job.
 */
export async function addFollowUpScannerJob(data: FollowUpScannerJobData): Promise<string> {
  const queues = getQueues();
  const job = await queues[QUEUE_NAMES.FOLLOW_UP_SCANNER].add('scan', data, {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueue a deal scoring job.
 */
export async function addDealScoringJob(data: DealScoringJobData): Promise<string> {
  const queues = getQueues();
  const job = await queues[QUEUE_NAMES.DEAL_SCORING].add('score', data, {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
  });
  return job.id ?? 'unknown';
}

/**
 * Enqueue a meeting prep job.
 */
export async function addMeetingPrepJob(data: MeetingPrepJobData): Promise<string> {
  const queues = getQueues();
  const job = await queues[QUEUE_NAMES.MEETING_PREP].add('prep', data, {
    removeOnComplete: 50,
    removeOnFail: 20,
    attempts: 2,
  });
  return job.id ?? 'unknown';
}
