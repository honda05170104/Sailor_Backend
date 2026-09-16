export default {
  name: '018_user_stored_credit',
  async up(db) {
    await db.collection('users').updateMany(
      { storedCredit: { $exists: false } },
      { $set: { storedCredit: 0 } }
    );
  },
};
