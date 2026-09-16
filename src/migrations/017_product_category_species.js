async function dropIndex(collection, name) {
  try {
    await collection.dropIndex(name);
  } catch (error) {
    if (error?.code !== 27 && error?.codeName !== 'IndexNotFound') throw error;
  }
}

export default {
  name: '017_product_category_species',
  async up(db) {
    const products = db.collection('products');
    const subcategories = db.collection('productsubcategories');
    const subs = await subcategories.find().toArray();
    const subMap = new Map(subs.map((item) => [String(item._id), item.category]));

    const docs = await products.find().toArray();
    for (const doc of docs) {
      if (doc.category) continue;
      const categoryId = doc.subcategory ? subMap.get(String(doc.subcategory)) : null;
      if (categoryId) {
        await products.updateOne(
          { _id: doc._id },
          { $set: { category: categoryId }, $unset: { subcategory: '' } }
        );
      } else {
        await products.updateOne({ _id: doc._id }, { $unset: { subcategory: '' } });
      }
    }

    await dropIndex(products, 'subcategory_1');
    await dropIndex(products, 'subcategory_1_name_1');
    await products.createIndex({ category: 1 });
    await products.createIndex({ enabled: 1 });
    await products.createIndex({ category: 1, name: 1 }, { unique: true });
  },
};
