import { generateTxnNo } from '../services/transactions.js';

export default {
  name: '031_transaction_txn_no',
  async up(db) {
    const docs = await db
      .collection('transactions')
      .find({
        $or: [{ txnNo: { $exists: false } }, { txnNo: null }, { txnNo: '' }],
      })
      .project({ _id: 1, createdAt: 1 })
      .toArray();

    const used = new Set();
    const existing = await db
      .collection('transactions')
      .find({ txnNo: { $gt: '' } })
      .project({ txnNo: 1 })
      .toArray();
    for (const doc of existing) used.add(doc.txnNo);

    const now = new Date();
    for (const doc of docs) {
      let txnNo = generateTxnNo(doc.createdAt ? new Date(doc.createdAt) : now);
      while (used.has(txnNo)) {
        txnNo = generateTxnNo(doc.createdAt ? new Date(doc.createdAt) : now);
      }
      used.add(txnNo);
      await db.collection('transactions').updateOne(
        { _id: doc._id },
        { $set: { txnNo, updatedAt: now } }
      );
    }

    await db.collection('transactions').createIndex(
      { txnNo: 1 },
      { unique: true }
    );
  },
};
