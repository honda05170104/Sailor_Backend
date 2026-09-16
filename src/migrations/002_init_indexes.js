export default {
  name: '002_init_indexes',
  async up(db) {
    await db.collection('users').createIndex({ lineUserId: 1 }, { unique: true });
    await db.collection('tokens').createIndex({ token: 1 }, { unique: true });
    await db.collection('tokens').createIndex({ user: 1 });
    await db.collection('tokens').createIndex({ manager: 1 });
    await db.collection('managers').createIndex({ username: 1 }, { unique: true });
    await db.collection('managers').createIndex({ type: 1 });
    await db.collection('branches').createIndex({ type: 1 });
  },
};
