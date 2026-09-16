export default {
  name: '013_init_coupons',
  async up(db) {
    await db.collection('coupons').createIndex({ name: 1 });
    await db.collection('coupons').createIndex({ enabled: 1 });
    await db.collection('userCoupons').createIndex({ user: 1, status: 1 });
    await db.collection('userCoupons').createIndex({ coupon: 1 });
  },
};
