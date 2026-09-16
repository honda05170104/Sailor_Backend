import { DEFAULT_TIMES, GLOBAL_CONFIG_KEY } from '../utils/globalConfig.js';

export default {
  name: '022_init_global_config',
  async up(db) {
    await db.collection('globalConfig').createIndex({ key: 1 }, { unique: true });
    await db.collection('globalConfig').updateOne(
      { key: GLOBAL_CONFIG_KEY },
      {
        $setOnInsert: {
          key: GLOBAL_CONFIG_KEY,
          times: DEFAULT_TIMES,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
  },
};
