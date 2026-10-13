export default {
  name: '041_unset_user_other_species',
  async up(db) {
    await db.collection('users').updateMany(
      { otherSpecies: { $exists: true } },
      { $unset: { otherSpecies: '' } }
    );
  },
};
