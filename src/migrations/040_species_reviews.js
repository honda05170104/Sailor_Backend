export default {
  name: '040_species_reviews',
  async up(db) {
    const reviews = db.collection('speciesreviews');
    await reviews.createIndex({ status: 1, createdAt: -1 });
    await reviews.createIndex({ user: 1, status: 1, name: 1 });

    const users = await db
      .collection('users')
      .find({ otherSpecies: { $type: 'string', $gt: '' } })
      .toArray();
    const now = new Date();

    for (const user of users) {
      const name = String(user.otherSpecies || '').trim();
      if (!name) continue;

      const existing = await reviews.findOne({
        user: user._id,
        name,
        status: 'pending',
      });
      if (existing) continue;

      await reviews.insertOne({
        user: user._id,
        name,
        status: 'pending',
        species: null,
        parent: null,
        reviewedAt: null,
        createdAt: user.updatedAt || now,
        updatedAt: now,
      });
    }
  },
};
