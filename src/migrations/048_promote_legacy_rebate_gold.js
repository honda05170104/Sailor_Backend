import { backfillPosLegacyRebates } from '../manager/services/promotion.service.js';

export default {
  name: '048_promote_legacy_rebate_gold',
  async up() {
    const results = await backfillPosLegacyRebates();
    const counts = {};
    for (const row of results) {
      const key = `${row.action}/${row.vip || 'none'}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    console.log(`[048] legacy rebate gold ${JSON.stringify(counts)}`);
    for (const row of results) {
      console.log(
        `[048] coupon=${row.action} vip=${row.vip || 'none'} ${row.mobile || row.userId} ${row.displayName || ''}`.trim()
      );
    }
  },
};
