import { VIP_SPEND_WINDOW_MS, getVipById } from '../services/vip.js';

export default {
  name: '032_user_vip_expires_at',
  async up(db) {
    const now = new Date();
    await db.collection('users').updateMany(
      { vipExpiresAt: { $exists: false } },
      { $set: { vipExpiresAt: null } }
    );

    const users = await db
      .collection('users')
      .find({ vip: { $ne: null } })
      .project({ _id: 1, vip: 1, vipExpiresAt: 1 })
      .toArray();

    for (const user of users) {
      const vip = getVipById(user.vip);
      if (!vip || (vip.rank || 0) <= 1) continue;
      if (user.vipExpiresAt) continue;

      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            vipExpiresAt: new Date(now.getTime() + VIP_SPEND_WINDOW_MS),
            updatedAt: now,
          },
        }
      );
    }
  },
};
