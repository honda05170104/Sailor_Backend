export default {
  name: '010_user_total_spend',
  async up(db) {
    await db.collection('users').updateMany(
      { totalSpend: { $exists: false } },
      { $set: { totalSpend: 0 } }
    );

    const totals = await db
      .collection('transactions')
      .aggregate([
        { $group: { _id: '$user', total: { $sum: '$totalAmount' } } },
      ])
      .toArray();

    for (const row of totals) {
      if (!row._id) continue;
      await db.collection('users').updateOne(
        { _id: row._id },
        { $set: { totalSpend: row.total || 0 } }
      );
    }
  },
};
