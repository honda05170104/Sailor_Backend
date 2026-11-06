import { vipGiftPromotions } from '../data/vips.js';

/** Point VIP gift coupons and promotion copy at src/data/vips.js. */
export default {
  name: '053_sync_vip_gift_amounts',
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
