import { listStores, defaultStore } from '../../data/stores.js';

export async function listBranches() {
  return {
    branches: listStores(),
  };
}

export async function defaultBranch() {
  return defaultStore();
}
