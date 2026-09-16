export default {
  name: '020_rename_products_to_animals',
  async up(db) {
    const names = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
    );

    if (names.has('products') && !names.has('animals')) {
      await db.collection('products').rename('animals');
    }

    await db.collection('users').updateMany(
      { products: { $exists: true } },
      { $rename: { products: 'animals' } }
    );
    await db.collection('users').updateMany(
      { animals: { $exists: false } },
      { $set: { animals: [] } }
    );
  },
};
