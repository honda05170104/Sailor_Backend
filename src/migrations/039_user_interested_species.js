export default {
  name: '039_user_interested_species',
  async up(db) {
    await db.collection('users').updateMany(
      { interestedSpecies: { $exists: false } },
      { $set: { interestedSpecies: [] } }
    );
    await db.collection('users').updateMany(
      { otherSpecies: { $exists: false } },
      { $set: { otherSpecies: '' } }
    );
    await db.collection('users').updateMany(
      { otherSpecies: { $type: 'array' } },
      { $set: { otherSpecies: '' } }
    );
    await db.collection('users').updateMany(
      { speciesFormFilled: { $exists: false } },
      { $set: { speciesFormFilled: false } }
    );
  },
};
