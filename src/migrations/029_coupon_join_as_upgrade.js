export default {
  name: '029_coupon_join_as_upgrade',
  async up(db) {
    await db.collection('coupons').updateMany(
      { category: 'join' },
      { $set: { category: 'upgrade', updatedAt: new Date() } }
    );
  },
};
