import { getVipBySlug } from '../data/vips.js';

function money(amount) {
  return Number(amount || 0).toLocaleString('zh-TW');
}

/** Point upgrade-gift copy at the spend threshold in src/data/vips.js. */
export default {
  name: '052_sync_upgrade_promotion_copy',
  async up(db) {
    const specs = [
      ['upgrade-gold', 'gold'],
      ['upgrade-black', 'black'],
    ];
    const now = new Date();

    for (const [key, slug] of specs) {
      const vip = getVipBySlug(slug);
      const promo = await db.collection('promotions').findOne({ key });
      if (!vip || !promo) continue;

      const coupon = promo.coupon
        ? await db.collection('coupons').findOne({ _id: promo.coupon })
        : null;
      const value = Number(coupon?.value) || 0;
      const description = value
        ? `近一年累積消費滿 ${money(vip.minSpend)} 元升等${vip.name}時發放 ${money(value)} 元優惠券。`
        : `近一年累積消費滿 ${money(vip.minSpend)} 元升等${vip.name}。`;

      await db.collection('promotions').updateOne(
        { _id: promo._id },
        { $set: { description, updatedAt: now } }
      );
    }
  },
};
