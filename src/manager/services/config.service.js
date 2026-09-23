import GlobalConfig from '../../models/GlobalConfig.js';
import {
  GLOBAL_CONFIG_KEY,
  DEFAULT_TIMES,
  parseTimesPayload,
} from '../../services/globalConfig.js';

export async function ensureGlobalConfig() {
  const existing = await GlobalConfig.findOne({ key: GLOBAL_CONFIG_KEY });
  if (existing) return existing;

  return GlobalConfig.create({
    key: GLOBAL_CONFIG_KEY,
    times: DEFAULT_TIMES,
  });
}

export async function getConfig() {
  const config = await ensureGlobalConfig();
  return { config: config.toSafeJSON() };
}

export async function getTimes() {
  const { config } = await getConfig();
  return config.times;
}

export async function updateConfig(payload = {}) {
  const config = await ensureGlobalConfig();
  config.times = parseTimesPayload(payload, config.toSafeJSON().times);
  await config.save();
  return { config: config.toSafeJSON() };
}
