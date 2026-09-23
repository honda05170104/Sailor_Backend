import { listVips, runDailyVipSync, runDailyCashback } from '../../services/vip.js';

export async function listVipsForManager() {
  return {
    vips: listVips(),
  };
}

/** Manual trigger for the daily VIP upgrade/downgrade job. */
export async function runVipDailySync() {
  const result = await runDailyVipSync();
  return { result };
}

/** Manual trigger for the daily points cashback job. */
export async function runVipDailyCashback() {
  const result = await runDailyCashback();
  return { result };
}

