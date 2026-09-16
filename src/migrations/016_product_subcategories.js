async function dropIndex(collection, name) {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') throw error;
  }
}

export default {
  name: '016_product_subcategories',
  async up(db) {
    const categories = db.collection('productcategories');
    const products = db.collection('products');
    const subcategories = db.collection('productsubcategories');

    await dropIndex(categories, 'parent_1');
    await dropIndex(categories, 'parent_1_name_1');
    await categories.createIndex({ name: 1 }, { unique: true });
    await categories.createIndex({ enabled: 1 });

    await subcategories.createIndex({ category: 1 });
    await subcategories.createIndex({ enabled: 1 });
    await subcategories.createIndex({ category: 1, name: 1 }, { unique: true });

    await dropIndex(products, 'category_1');
    await dropIndex(products, 'category_1_name_1');
    await products.createIndex({ subcategory: 1 });
    await products.createIndex({ enabled: 1 });
    await products.createIndex({ subcategory: 1, name: 1 }, { unique: true });

    await db.collection('users').updateMany(
      { products: { $exists: false } },
      { $set: { products: [] } }
    );
  },
};
