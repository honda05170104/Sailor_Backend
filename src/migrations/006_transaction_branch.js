export default {
  name: '006_transaction_branch',
  async up(db) {
    try {
      await db.collection('transactions').dropIndex('user_1_externalOrderId_1');
    } catch {
      /* index may not exist */
    }

    await db.collection('transactions').createIndex({ branch: 1 });
    await db.collection('transactions').createIndex(
      { branch: 1, externalOrderId: 1 },
      { unique: true }
    );
  },
};
