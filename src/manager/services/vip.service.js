import { listVips } from '../../services/vip.js';

export async function listVipsForManager() {
  return {
    vips: listVips(),
  };
}

