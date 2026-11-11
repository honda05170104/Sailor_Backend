/** One import batch per store per business day. */
export default {
  name: '054_unique_order_import_day',
  async up(db) {
    await db.collection('orderimports').createIndex(
      { branch: 1, orderDate: 1 },
      { unique: true }
    );
  },
};
