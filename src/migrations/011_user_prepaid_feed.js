export default {
  name: '011_user_prepaid_feed',
  async up(db) {
    await db.collection('users').updateMany(
      { prepaidFeed: { $exists: false } },
      { $set: { prepaidFeed: 0 } }
    );
  },
};
