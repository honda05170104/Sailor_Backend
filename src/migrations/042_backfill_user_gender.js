export default {
  name: '042_backfill_user_gender',
  async up(db) {
    await db.collection('users').updateMany(
      { $or: [{ gender: { $exists: false } }, { gender: { $in: ['', null] } }] },
      { $set: { gender: 'male' } }
    );
  },
};
