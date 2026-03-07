import { Queue, type ConnectionOptions } from 'bullmq';
import { getConnectionOptions, QUEUE_NAMES } from './index.js';
import { startWorkers } from './workers.js';
import { getServiceClient } from '../lib/supabase.js';

/**
 * Initialize the BullMQ job scheduler with repeatable jobs.
 * Called once at server startup.
 */
export async function initScheduler(): Promise<void> {
  const connection = getConnectionOptions();

  console.log('[scheduler] Initializing job scheduler...');

  // Start all workers first
  startWorkers();

  // Create queues for scheduling
  const emailSyncQueue = new Queue(QUEUE_NAMES.EMAIL_SYNC, { connection });
  const followUpQueue = new Queue(QUEUE_NAMES.FOLLOW_UP_SCANNER, { connection });
  const dealScoringQueue = new Queue(QUEUE_NAMES.DEAL_SCORING, { connection });
  const meetingPrepQueue = new Queue(QUEUE_NAMES.MEETING_PREP, { connection });

  // ── Email Sync: every 5 minutes ────────────────────────────────────────

  await emailSyncQueue.upsertJobScheduler(
    'email-sync-scheduler',
    {
      every: 5 * 60 * 1000, // 5 minutes
    },
    {
      name: 'scheduled-email-sync',
      data: { scheduledRun: true },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }
  );

  // ── Follow-Up Scanner: every hour ──────────────────────────────────────

  await followUpQueue.upsertJobScheduler(
    'follow-up-scanner-scheduler',
    {
      every: 60 * 60 * 1000, // 1 hour
    },
    {
      name: 'scheduled-follow-up-scan',
      data: { scheduledRun: true },
      opts: {
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }
  );

  // ── Deal Scoring: daily at 6 AM ───────────────────────────────────────

  await dealScoringQueue.upsertJobScheduler(
    'deal-scoring-scheduler',
    {
      pattern: '0 6 * * *', // 6 AM daily (cron)
    },
    {
      name: 'scheduled-deal-scoring',
      data: { scheduledRun: true },
      opts: {
        removeOnComplete: 30,
        removeOnFail: 10,
      },
    }
  );

  // ── Meeting Prep: every 30 minutes ────────────────────────────────────

  await meetingPrepQueue.upsertJobScheduler(
    'meeting-prep-scheduler',
    {
      every: 30 * 60 * 1000, // 30 minutes
    },
    {
      name: 'scheduled-meeting-prep',
      data: { scheduledRun: true },
      opts: {
        removeOnComplete: 30,
        removeOnFail: 10,
      },
    }
  );

  console.log('[scheduler] Job scheduler initialized with repeatable jobs:');
  console.log('  - Email sync: every 5 minutes');
  console.log('  - Follow-up scanner: every hour');
  console.log('  - Deal scoring: daily at 6 AM');
  console.log('  - Meeting prep: every 30 minutes');

  // ── Handle scheduled jobs that need per-user dispatch ──────────────────

  // For scheduled jobs, we need to iterate over all active users
  // and create individual per-user jobs
  const emailSyncScheduledQueue = new Queue(QUEUE_NAMES.EMAIL_SYNC, { connection });

  emailSyncScheduledQueue.on('waiting', async (job) => {
    if (job.name === 'scheduled-email-sync') {
      await dispatchToAllUsers(QUEUE_NAMES.EMAIL_SYNC, connection);
    }
  });
}

/**
 * Dispatch a job to all active users.
 * Used by scheduled jobs that need to run per-user.
 */
async function dispatchToAllUsers(
  queueName: string,
  connection: ConnectionOptions
): Promise<void> {
  try {
    const supabase = getServiceClient();

    // Fetch all users with active linked accounts
    const { data: users } = await supabase
      .from('linked_accounts')
      .select('user_id')
      .eq('is_active', true)
      .eq('provider', 'google');

    if (!users || users.length === 0) return;

    const uniqueUserIds = [...new Set(users.map((u) => u.user_id))];
    const queue = new Queue(queueName, { connection });

    for (const userId of uniqueUserIds) {
      await queue.add(
        `per-user-${queueName}`,
        { userId },
        {
          removeOnComplete: 50,
          removeOnFail: 20,
          attempts: 2,
          backoff: { type: 'exponential', delay: 5000 },
          // Deduplicate by userId -- don't add if same user job is waiting
          jobId: `${queueName}-${userId}-${new Date().toISOString().slice(0, 13)}`,
        }
      );
    }

    console.log(
      `[scheduler] Dispatched ${queueName} jobs to ${uniqueUserIds.length} users`
    );
  } catch (error) {
    console.error(`[scheduler] Failed to dispatch ${queueName} to users:`, error);
  }
}
