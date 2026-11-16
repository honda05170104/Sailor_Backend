import { promoteLegacyRebateHolders } from '../manager/services/promotion.service.js';

/** Move 舊會員回饋 / 舊會員回饋金 members from gold (or lower) up to black. */
export default {
  name: '056_promote_legacy_rebate_black',
  async up() {
    const results = await promoteLegacyRebateHolders();
    const counts = {};
    for (const row of results) {
      const key = `${row.prevVip || 'none'}->${row.vip || 'none'}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log(`[056] legacy rebate black ${JSON.stringify(counts)}`);
    for (const row of results) {
      console.log(
        `[056] ${row.prevVip || 'none'}->${row.vip || 'none'} ${row.mobile || row.userId} ${row.displayName || ''}`.trim()
      );
    }
  },
};
