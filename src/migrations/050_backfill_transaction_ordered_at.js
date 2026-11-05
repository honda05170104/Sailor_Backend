import { orderTimeFromOrderNo } from '../services/transactions.js';

/** Fill orderedAt from POS order numbers, or createdAt for system rows. */
export default {
  name: '050_backfill_transaction_ordered_at',
  async up(db) {
    const docs = await db
      .collection('transactions')
      .find({
        $or: [{ orderedAt: { $exists: false } }, { orderedAt: null }],
      })
      .project({ _id: 1, orderNo: 1, createdAt: 1, importedAt: 1 })
      .toArray();

    const now = new Date();
    for (const doc of docs) {
      const orderedAt =
        orderTimeFromOrderNo(doc.orderNo) ||
        (doc.createdAt ? new Date(doc.createdAt) : null) ||
        (doc.importedAt ? new Date(doc.importedAt) : null) ||
        now;
      await db.collection('transactions').updateOne(
        { _id: doc._id },
        { $set: { orderedAt } }
      );
    }

    await db.collection('transactions').createIndex(
      { user: 1, orderedAt: -1 },
      { name: 'user_1_orderedAt_-1' }
    );
  },
};
