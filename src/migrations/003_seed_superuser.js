import Manager from '../models/Manager.js';

export default {
  name: '003_seed_superuser',
  async up() {
    const exists = await Manager.exists({});
    if (exists) return;

    const username = (process.env.MANAGER_BOOTSTRAP_USERNAME || 'admin').toLowerCase();
    const password = process.env.MANAGER_BOOTSTRAP_PASSWORD || 'admin123';

    const manager = new Manager({
      username,
      name: 'Superuser',
      type: 'superuser',
    });
    manager.setPassword(password);
    await manager.save();

    console.log(`  seeded manager: ${username}`);
  },
};
