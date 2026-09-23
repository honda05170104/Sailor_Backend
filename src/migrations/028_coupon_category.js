import { ObjectId } from 'mongodb';

/** Seed VIP gift coupons with category for admin filters. */
const CATEGORY_BY_ID = {
  '7a96b19f24ebb49b9046b701': 'upgrade',
  '7a96b19f24ebb49b9046b702': 'upgrade',
  '7a96b19f24ebb49b9046b704': 'upgrade',
  '7a96b19f24ebb49b9046b705': 'birthday',
  '7a96b19f24ebb49b9046b703': 'birthday',
};

export default {
  name: '028_coupon_category',
  async up(db) {
    await db.collection('coupons').createIndex({ category: 1 });

    await db.collection('coupons').updateMany(
      { category: { $exists: false } },
      { $set: { category: 'general' } }
    );

    const now = new Date();
    for (const [id, category] of Object.entries(CATEGORY_BY_ID)) {
      await db.collection('coupons').updateOne(
        { _id: new ObjectId(id) },
        { $set: { category, updatedAt: now } }
      );
    }
  },
};
