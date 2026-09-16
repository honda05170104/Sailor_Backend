export default {
  name: '012_drop_points',
  async up(db) {
    await db.collection('users').updateMany({}, { $unset: { points: '' } });
    await db.collection('vips').updateMany({}, { $unset: { pointsRate: '' } });
  },
};
