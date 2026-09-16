export default {
  name: '014_drop_prepaid_feed_coupons',
  async up(db) {
    await db.collection('coupons').deleteMany({ type: 'prepaidFeed' });
    await db.collection('userCoupons').deleteMany({ type: 'prepaidFeed' });
  },
};
