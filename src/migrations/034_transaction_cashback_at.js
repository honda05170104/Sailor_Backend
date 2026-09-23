/**
 * Mark spend transactions cashback tracking fields.
 * cashbackAt = null means not yet processed by the daily cashback job.
 */
export default {
  name: '034_transaction_cashback_at',
  async up(db) {
    await db.collection('transactions').updateMany(
      { cashbackAt: { $exists: false } },
      { $set: { cashbackAt: null, cashbackPoints: 0 } }
    );
    await db.collection('transactions').createIndex(
      { cashbackAt: 1, source: 1 },
      { name: 'cashbackAt_1_source_1' }
    );
  },
};
