import { promoteLegacyRebateHolders } from '../manager/services/promotion.service.js';

export default {
  name: '049_promote_legacy_rebate_holders',
  async up() {
    const results = await promoteLegacyRebateHolders();
    const counts = {};
    for (const row of results) {
      counts[row.vip] = (counts[row.vip] || 0) + 1;
    }
    console.log(`[049] legacy rebate holders ${JSON.stringify(counts)}`);
    for (const row of results) {
      if (row.vip === 'already') continue;
      console.log(
        `[049] vip=${row.vip} ${row.mobile || row.userId} ${row.displayName || ''}`.trim()
      );
    }
  },
};
