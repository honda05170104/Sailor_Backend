export default {
  name: '033_rename_cashback_to_points',
  async up(db) {
    const now = new Date();
    await db.collection('transactions').updateMany(
      { source: 'VIP回饋' },
      { $set: { source: '點數回饋', updatedAt: now } }
    );
    await db.collection('transactions').updateMany(
      { 'items.name': '現金回饋' },
      {
        $set: {
          'items.$[item].name': '點數回饋',
          updatedAt: now,
        },
      },
      { arrayFilters: [{ 'item.name': '現金回饋' }] }
    );
    await db.collection('transactions').updateMany(
      { note: { $regex: '現金回饋' } },
      [
        {
          $set: {
            note: {
              $replaceAll: {
                input: '$note',
                find: '現金回饋',
                replacement: '點數回饋',
              },
            },
            updatedAt: now,
          },
        },
      ]
    );
  },
};
