export default {
  name: '001_cleanup_user_fields',
  async up(db) {
    await db.collection('users').updateMany(
      {},
      {
        $unset: {
          address: '',
          realName: '',
          avatarSource: '',
          authToken: '',
          authTokenIssuedAt: '',
        },
      }
    );

    await db.collection('users').updateMany(
      { mobile: { $exists: false } },
      { $set: { mobile: '' } }
    );
  },
};
