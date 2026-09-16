import { DEFAULT_VIPS } from '../utils/vip.js';

export default {
  name: '008_init_vips',
  async up(db) {
    const vips = db.collection('vips');
    await vips.createIndex({ slug: 1 }, { unique: true });
    await vips.createIndex({ rank: 1 });

    const now = new Date();
    for (const vip of DEFAULT_VIPS) {
      await vips.updateOne(
        { slug: vip.slug },
        {
          $set: {
            name: vip.name,
            rank: vip.rank,
            minSpend: vip.minSpend,
            discountPercent: vip.discountPercent,
            description: vip.description,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
    }

    const seeded = await vips.find().toArray();
    const bySlug = Object.fromEntries(seeded.map((vip) => [vip.slug, vip._id]));
    const fallback = bySlug.bronze || seeded[0]?._id;
    const users = db.collection('users');

    for (const [slug, vipId] of Object.entries(bySlug)) {
      await users.updateMany({ vipTier: slug }, { $set: { vip: vipId } });
    }

    await users.updateMany(
      { $or: [{ vip: { $exists: false } }, { vip: null }] },
      { $set: { vip: fallback } }
    );
    await users.updateMany({}, { $unset: { vipTier: '' } });
  },
};
