export default {
  name: '023_mouse_order_indexes',
  async up(db) {
    await db.collection('mouseorderweeks').createIndex({ weekOf: 1 }, { unique: true });
    await db.collection('mouseorderlines').createIndex(
      { weekOf: 1, form: 1, size: 1, spec: 1, ageDays: 1 },
      { unique: true }
    );
    await db.collection('mouseorderlines').createIndex({ weekOf: 1, createdAt: 1 });
  },
};
