import { backfillPosJoinGifts } from '../manager/services/promotion.service.js';

export default {
  name: '046_redeem_pos_join_gifts',
  async up() {
    const results = await backfillPosJoinGifts();
    const counts = {};
    for (const row of results) {
      counts[row.action] = (counts[row.action] || 0) + 1;
    }
    console.log(`[046] pos join gifts ${JSON.stringify(counts)}`);
    for (const row of results) {
      console.log(
        `[046] ${row.action} ${row.mobile || row.userId} ${row.displayName || ''}`.trim()
      );
    }
  },
};
