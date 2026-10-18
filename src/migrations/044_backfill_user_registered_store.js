export default {
  name: '044_backfill_user_registered_store',
  async up(db) {
    await db.collection('users').updateMany(
      {
        $or: [
          { registeredStore: { $exists: false } },
          { registeredStore: null },
        ],
      },
      { $set: { registeredStore: 1 } }
    );
  },
};
