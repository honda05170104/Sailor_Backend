export default {
  name: '021_rename_productcategories_to_animalsCategory',
  async up(db) {
    const names = new Set(
      (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
    );

    if (names.has('productcategories') && !names.has('animalsCategory')) {
      await db.collection('productcategories').rename('animalsCategory');
      return;
    }

    if (names.has('productcategories') && names.has('animalsCategory')) {
      const docs = await db.collection('productcategories').find().toArray();
      if (docs.length) {
        await db.collection('animalsCategory').insertMany(docs, { ordered: false }).catch((error) => {
          if (error?.code !== 11000) throw error;
        });
      }
      await db.collection('productcategories').drop();
    }
  },
};
