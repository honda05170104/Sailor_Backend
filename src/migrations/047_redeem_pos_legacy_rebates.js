import { backfillPosLegacyRebates } from '../manager/services/promotion.service.js';

export default {
  name: '047_redeem_pos_legacy_rebates',
  async up() {
    const results = await backfillPosLegacyRebates();
    const counts = {};
    for (const row of results) {
      counts[row.action] = (counts[row.action] || 0) + 1;
    }
    console.log(`[047] pos legacy rebates ${JSON.stringify(counts)}`);
    for (const row of results) {
      console.log(
        `[047] ${row.action} ${row.mobile || row.userId} ${row.displayName || ''}`.trim()
      );
    }
  },
};
