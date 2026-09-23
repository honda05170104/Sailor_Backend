import {
  DEFAULT_TRANSACTION_ORDER_STATUS,
  normalizeOrderStatus,
} from '../services/transactions.js';

export default {
  name: '030_transaction_order_status_enum',
  async up(db) {
    const docs = await db
      .collection('transactions')
      .find({}, { projection: { orderStatus: 1 } })
      .toArray();

    const now = new Date();
    for (const doc of docs) {
      const next = normalizeOrderStatus(doc.orderStatus);
      if (doc.orderStatus === next) continue;
      await db.collection('transactions').updateOne(
        { _id: doc._id },
        { $set: { orderStatus: next, updatedAt: now } }
      );
    }

    await db.collection('transactions').updateMany(
      {
        $or: [
          { orderStatus: { $exists: false } },
          { orderStatus: null },
          { orderStatus: '' },
        ],
      },
      { $set: { orderStatus: DEFAULT_TRANSACTION_ORDER_STATUS, updatedAt: now } }
    );

    await db.collection('transactions').createIndex({ orderStatus: 1 });
  },
};
