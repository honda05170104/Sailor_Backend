export default {
  name: '009_init_tags',
  async up(db) {
    await db.collection('tags').createIndex({ name: 1 }, { unique: true });
    await db.collection('users').updateMany(
      { tags: { $exists: false } },
      { $set: { tags: [] } }
    );
  },
};
