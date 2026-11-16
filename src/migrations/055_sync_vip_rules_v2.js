import { vipGiftPromotions } from '../data/vips.js';

/** Sync VIP gift coupons / promotion copy after v2 threshold and amount changes. */
export default {
  name: '055_sync_vip_rules_v2',
  async up(db) {
    const now = new Date();

    for (const gift of vipGiftPromotions()) {
      const promo = await db.collection('promotions').findOne({ key: gift.key });
      if (!promo) continue;

      if (promo.coupon) {
        await db.collection('coupons').updateOne(
          { _id: promo.coupon },
          {
            $set: {
              name: gift.couponName,
              description: gift.couponDescription,
              value: gift.amount,
              expiryMode: 'relative',
              expireDays: gift.expireDays,
              startsAt: null,
              endsAt: null,
              updatedAt: now,
            },
          }
        );
      }

      await db.collection('promotions').updateOne(
        { _id: promo._id },
        {
          $set: {
            name: gift.promotionName,
            description: gift.promotionDescription,
            updatedAt: now,
          },
        }
      );
    }
  },
};
