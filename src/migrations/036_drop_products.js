async function dropCollection(db, name) {
  await db.collection(name).drop().catch((error) => {
    if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) throw error;
  });
}

export default {
  name: '036_drop_products',
  async up(db) {
    await dropCollection(db, 'products');
    await dropCollection(db, 'productcategories');
    await dropCollection(db, 'productsubcategories');
    await db.collection('users').updateMany(
      { $or: [{ products: { $exists: true } }, { animals: { $exists: true } }] },
      { $unset: { products: '', animals: '' } }
    );
  },
};
