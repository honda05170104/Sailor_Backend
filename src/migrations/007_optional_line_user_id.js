export default {
  name: '007_optional_line_user_id',
  async up(db) {
    await db.collection('users').updateMany(
      { $or: [{ lineUserId: '' }, { lineUserId: null }] },
      { $unset: { lineUserId: '' } }
    );

    try {
      await db.collection('users').dropIndex('lineUserId_1');
    } catch {
      /* index may not exist */
    }

    await db.collection('users').createIndex(
      { lineUserId: 1 },
      { unique: true, sparse: true }
    );

    try {
      await db.collection('users').dropIndex('mobile_1');
    } catch {
      /* index may not exist */
    }

    await db.collection('users').createIndex(
      { mobile: 1 },
      { unique: true, partialFilterExpression: { mobile: { $gt: '' } } }
    );
  },
};
