export default {
  name: '024_mouse_order_user',
  async up(db) {
    const lines = db.collection('mouseorderlines');
    await lines.deleteMany({ user: { $exists: false } });
    await lines.deleteMany({ user: null });

    const indexes = await lines.indexes();
    const oldUnique = indexes.find(
      (index) =>
        index.key?.weekOf === 1 &&
        index.key?.form === 1 &&
        index.key?.size === 1 &&
        index.key?.spec === 1 &&
        index.key?.ageDays === 1 &&
        index.key?.user == null
    );
    if (oldUnique?.name) {
      await lines.dropIndex(oldUnique.name);
    }

    await lines.createIndex(
      { weekOf: 1, user: 1, form: 1, size: 1, spec: 1, ageDays: 1 },
      { unique: true }
    );
    await lines.createIndex({ weekOf: 1, user: 1 });
  },
};
