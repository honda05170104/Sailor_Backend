async function dropCollection(db, name) {
  await db.collection(name).drop().catch((error) => {
    if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) throw error;
  });
}

export default {
  name: '035_drop_animals',
  async up(db) {
    await dropCollection(db, 'animals');
    await dropCollection(db, 'animalsCategory');
    await db.collection('users').updateMany(
      { animals: { $exists: true } },
      { $unset: { animals: '' } }
    );
  },
};
