export default {
  name: '045_init_order_imports',
  async up(db) {
    await db.collection('orderimports').createIndex({ branch: 1 });
    await db.collection('orderimports').createIndex({ orderDate: -1, createdAt: -1 });
    await db.collection('importedorders').createIndex({ import: 1 });

    const orders = await db
      .collection('importedorders')
      .find({
        $or: [{ import: { $exists: false } }, { import: null }],
      })
      .toArray();

    const groups = new Map();
    for (const order of orders) {
      const created = order.createdAt ? new Date(order.createdAt) : new Date();
      const orderDate = created.toLocaleDateString('sv-SE', {
        timeZone: 'Asia/Taipei',
      });
      const key = `${String(order.branch)}|${orderDate}`;
      if (!groups.has(key)) {
        groups.set(key, {
          branch: order.branch,
          orderDate,
          createdAt: created,
          ids: [],
        });
      }
      const group = groups.get(key);
      group.ids.push(order._id);
      if (created < group.createdAt) group.createdAt = created;
    }

    const now = new Date();
    for (const group of groups.values()) {
      const result = await db.collection('orderimports').insertOne({
        branch: group.branch,
        fileName: '',
        orderDate: group.orderDate,
        totalOrders: group.ids.length,
        imported: 0,
        skippedNoMobile: 0,
        skippedDuplicate: 0,
        skippedVoided: 0,
        createdAt: group.createdAt,
        updatedAt: now,
      });
      await db.collection('importedorders').updateMany(
        { _id: { $in: group.ids } },
        { $set: { import: result.insertedId } }
      );
    }
  },
};
