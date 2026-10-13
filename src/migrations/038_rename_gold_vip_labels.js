function renameGoldLabel(value) {
  if (typeof value !== 'string' || !value.includes('金卡')) return null;
  return value.replaceAll('金卡', '白金');
}

export default {
  name: '038_rename_gold_vip_labels',
  async up(db) {
    for (const collectionName of ['promotions', 'coupons', 'usercoupons']) {
      const collection = db.collection(collectionName);
      const docs = await collection
        .find({
          $or: [{ name: /金卡/ }, { description: /金卡/ }],
        })
        .toArray();

      for (const doc of docs) {
        const update = {};
        const name = renameGoldLabel(doc.name);
        const description = renameGoldLabel(doc.description);
        if (name) update.name = name;
        if (description) update.description = description;
        if (Object.keys(update).length) {
          await collection.updateOne({ _id: doc._id }, { $set: update });
        }
      }
    }
  },
};
