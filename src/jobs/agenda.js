import Agenda from 'agenda';
import mongoose from 'mongoose';
import { runDailyPromotionChecks } from '../manager/services/promotion.service.js';
import { runDailyVipSync, runDailyCashback } from '../services/vip.js';

const JOB_DAILY_PROMOTIONS = 'promotions.daily';
const JOB_DAILY_VIP_SYNC = 'vip.dailySync';
const JOB_DAILY_CASHBACK = 'vip.dailyCashback';

/** 台北時間每天 03:00：先升降級與升等券，再發點數。 */
const DAILY_MEMBER_SYNC_CRON = '0 3 * * *';

let agenda;

export async function startAgenda() {
  if (agenda) return agenda;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  const dbName = process.env.DB_NAME || 'sailor';

  agenda = new Agenda({
    db: {
      address: uri,
      collection: 'agendaJobs',
      options: { dbName },
    },
    processEvery: '1 minute',
    maxConcurrency: 2,
    defaultConcurrency: 1,
  });

  agenda.define(JOB_DAILY_PROMOTIONS, async () => {
    const result = await runDailyPromotionChecks();
    console.log(`[agenda] ${JOB_DAILY_PROMOTIONS}`, JSON.stringify(result));
  });

  agenda.define(JOB_DAILY_VIP_SYNC, async () => {
    const vip = await runDailyVipSync();
    console.log(`[agenda] ${JOB_DAILY_VIP_SYNC}`, JSON.stringify(vip));
    const cashback = await runDailyCashback();
    console.log(`[agenda] ${JOB_DAILY_CASHBACK}`, JSON.stringify(cashback));
  });

  agenda.on('ready', () => {
    console.log('Agenda ready');
  });
  agenda.on('error', (error) => {
    console.error('Agenda error:', error?.message || error);
  });
  agenda.on('fail', (error, job) => {
    console.error(
      `Agenda job failed (${job?.attrs?.name}):`,
      error?.message || error
    );
  });

  await agenda.start();

  await agenda.cancel({ name: JOB_DAILY_CASHBACK });
  await agenda.every(
    DAILY_MEMBER_SYNC_CRON,
    JOB_DAILY_VIP_SYNC,
    {},
    {
      timezone: 'Asia/Taipei',
      skipImmediate: true,
    }
  );

  // Asia/Taipei 每月 1 號 04:00：生日禮。
  await agenda.every(
    '0 4 1 * *',
    JOB_DAILY_PROMOTIONS,
    {},
    {
      timezone: 'Asia/Taipei',
      skipImmediate: true,
    }
  );

  return agenda;
}

export async function stopAgenda() {
  if (!agenda) return;
  await agenda.stop();
  agenda = null;
}

export function getAgenda() {
  return agenda || null;
}

/** Shared mongoose connection optional hook (no-op if Agenda uses its own). */
export function agendaUsesDbName() {
  return mongoose.connection?.name || process.env.DB_NAME || 'sailor';
}
