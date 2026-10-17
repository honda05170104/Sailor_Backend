export default {
  name: '043_init_imported_orders',
  async up(db) {
    await db.collection('importedorders').createIndex({ branch: 1 });
    await db.collection('importedorders').createIndex(
      { branch: 1, externalOrderId: 1 },
      { unique: true }
    );
    await db.collection('transactions').createIndex({ importedOrder: 1 });
  },
};
