export default {
  name: '004_drop_sessions',
  async up(db) {
    const collections = await db.listCollections({ name: 'sessions' }).toArray();
    if (collections.length === 0) return;

    await db.collection('sessions').drop();
  },
};
