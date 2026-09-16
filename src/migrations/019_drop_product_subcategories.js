async function dropIndex(collection, name) {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') throw error;
  }
}

export default {
  name: '019_drop_product_subcategories',
  async up(db) {
    const products = db.collection('products');
    await products.updateMany(
      { subcategory: { $exists: true } },
      { $unset: { subcategory: '' } }
    );
    await dropIndex(products, 'subcategory_1');
    await dropIndex(products, 'subcategory_1_name_1');
    await db.collection('productsubcategories').drop().catch((error) => {
      if (error?.codeName !== 'NamespaceNotFound' && error?.code !== 26) throw error;
    });
  },
};
