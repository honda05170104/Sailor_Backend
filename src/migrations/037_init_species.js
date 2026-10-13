export default {
  name: '037_init_species',
  async up(db) {
    const species = db.collection('species');
    await species.createIndex({ parent: 1, name: 1 }, { unique: true });
    await species.createIndex({ parent: 1, sortOrder: 1, name: 1 });
  },
};
