export default {
  name: '005_init_transactions',
  async up(db) {
    await db.collection('transactions').createIndex({ user: 1 });
    await db.collection('transactions').createIndex({ orderNo: 1 });
    await db.collection('transactions').createIndex({ customerMobile: 1 });
    await db.collection('transactions').createIndex({ externalOrderId: 1 });
    await db.collection('transactions').createIndex(
      { user: 1, externalOrderId: 1 },
      { unique: true }
    );
  },
};
