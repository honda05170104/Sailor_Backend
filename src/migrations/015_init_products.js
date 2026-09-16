export default {
  name: '015_init_products',
  async up(db) {
    await db.collection('productcategories').createIndex({ parent: 1 });
    await db.collection('productcategories').createIndex({ enabled: 1 });
    await db.collection('productcategories').createIndex(
      { parent: 1, name: 1 },
      { unique: true }
    );
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ enabled: 1 });
    await db.collection('products').createIndex(
      { category: 1, name: 1 },
      { unique: true }
    );
    await db.collection('users').updateMany(
      { products: { $exists: false } },
      { $set: { products: [] } }
    );
  },
};
