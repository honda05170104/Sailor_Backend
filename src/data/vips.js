import mongoose from "mongoose";

/** Fixed VIP tiers — not stored in MongoDB. Keep ids stable for user.vip refs.
 *  minSpend = rolling 1-year spend to reach this tier.
 *  retainSpend = spend during the current membership year required to keep it.
 *  Member-facing spend copy is built from these numbers. */
const VIP_DEFS = [
  {
    id: "6a96b19f24ebb49b9046b616",
    name: "一般會員",
    slug: "normal",
    rank: 1,
    minSpend: 0,
    retainSpend: 0,
    discountPercent: 0,
    /** Points cashback: every `cashbackEvery` spend → `cashbackPoints`. 0 = none. */
    cashbackEvery: 0,
    cashbackPoints: 0,
    cashbackBonusDays: [],
    cashbackBonusMultiplier: 1,
    description: "入會會員。",
    perks: ["首次註冊即享 20元折價券"],
  },
  {
    id: "6a96b19f24ebb49b9046b617",
    name: "金卡",
    slug: "gold",
    rank: 2,
    minSpend: 3500,
    retainSpend: 3000,
    discountPercent: 0,
    cashbackEvery: 300,
    cashbackPoints: 1,
    /** Taipei calendar days when cashback points are multiplied. */
    cashbackBonusDays: [10],
    cashbackBonusMultiplier: 2,
    perksBeforePoints: ["用品類最低 85 折起（活體、餌料除外）"],
    perksAfterPoints: [
      "生日禮 100 元優惠券",
      "寄宿動物一天折 50 元",
      "史麥動物醫院掛號免服務費 https://petsmilehospital.com/",
    ],
  },
  {
    id: "6a96b19f24ebb49b9046b618",
    name: "黑卡",
    slug: "black",
    rank: 3,
    minSpend: 10000,
    retainSpend: 8000,
    discountPercent: 0,
    cashbackEvery: 200,
    cashbackPoints: 1,
    cashbackBonusDays: [10, 20],
    cashbackBonusMultiplier: 2,
    perksBeforePoints: [
      "用品類 最低 75 折起（活體、餌料除外）",
      "生日禮 300 元優惠券",
    ],
    perksAfterPoints: [
      "寄宿動物前3天免費 (一年 2 次)",
      "史麥動物醫院免掛號費 + 每年一次理學健檢(在官方 Line 通知我們幫您進行預約) https://petsmilehospital.com/",
      "黑卡專屬社群：搶先解鎖稀有物種預購權與專屬特惠，與資深玩家深度交流",
      "不定期提供品牌活動",
    ],
  },
];

/** 1 point redeems as 1 yuan. */
export const POINT_YUAN = 1;

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("zh-TW");
}

function previousPaidTier(def) {
  return (
    VIP_DEFS.filter((item) => item.rank > 1 && item.rank < def.rank).sort(
      (a, b) => b.rank - a.rank
    )[0] || null
  );
}

/** Upgrade / retain lines. Numbers come from the tier fields. */
export function vipSpendLines(vip, lower = null) {
  if (!vip || !(Number(vip.minSpend) > 0)) return [];
  const lines = [
    `近一年累積消費滿 ${formatMoney(vip.minSpend)} 元升等`,
    `會級期間消費滿 ${formatMoney(vip.retainSpend)} 元保留${vip.name}`,
  ];
  if (lower && Number(vip.retainSpend) > Number(lower.retainSpend)) {
    lines.push(
      `會級期間滿 ${formatMoney(lower.retainSpend)} 元、未滿 ${formatMoney(vip.retainSpend)} 元改為${lower.name}`
    );
  }
  return lines;
}

function pointLines(vip) {
  if (!(Number(vip.cashbackEvery) > 0) || !(Number(vip.cashbackPoints) > 0)) {
    return [];
  }
  const lines = [
    `單筆消費滿 ${formatMoney(vip.cashbackEvery)} 元，點數回饋 ${vip.cashbackPoints} 點`,
    `${POINT_YUAN} 點對應 ${POINT_YUAN} 元`,
  ];
  const days = Array.isArray(vip.cashbackBonusDays) ? vip.cashbackBonusDays : [];
  const multiplier = Number(vip.cashbackBonusMultiplier) || 1;
  if (days.length && multiplier > 1) {
    lines.push(`每月 ${days.join("、")} 號，點數 ${multiplier} 倍送`);
  }
  return lines;
}

function decorateVip(def) {
  const lower = previousPaidTier(def);
  const rules = vipSpendLines(def, lower);
  const perks = Array.isArray(def.perks) ? def.perks : [];
  const benefits = [
    ...(def.perksBeforePoints || []),
    ...pointLines(def),
    ...(def.perksAfterPoints || []),
    ...perks,
  ];
  const description = rules.length
    ? `${rules.join("。")}。`
    : def.description || "";
  return { ...def, description, rules, benefits };
}

export const VIPS = VIP_DEFS.map(decorateVip);

/** Lifetime spend threshold for gold downgrade protection. */
export const GOLD_PROTECT_MIN_LIFETIME_SPEND = 100;
/** Protection window length (3 years). */
export const GOLD_PROTECT_MS = 3 * 365.25 * 24 * 60 * 60 * 1000;

function membershipStart(user) {
  if (user?.createdAt) return new Date(user.createdAt);
  if (user?._id && typeof user._id.getTimestamp === "function") {
    return user._id.getTimestamp();
  }
  return null;
}

/** When 3-year gold floor protection ends; null if not applicable. */
export function getGoldProtectExpiresAt(user) {
  const start = membershipStart(user);
  if (!start) return null;
  return new Date(start.getTime() + GOLD_PROTECT_MS);
}

const vipById = new Map(VIPS.map((vip) => [String(vip.id), vip]));
const vipBySlug = new Map(VIPS.map((vip) => [vip.slug, vip]));

export function listVips() {
  return VIPS.map(toVipJSON);
}

export function getVipById(id) {
  if (id == null) return null;
  if (
    typeof id === "object" &&
    id.name != null &&
    (id.id != null || id._id != null)
  ) {
    return toVipJSON(id);
  }
  return vipById.get(String(id?._id || id)) || null;
}

export function getVipBySlug(slug) {
  return (
    vipBySlug.get(
      String(slug || "")
        .trim()
        .toLowerCase(),
    ) || null
  );
}

export function requireVip(id) {
  const vip = getVipById(id);
  if (!vip) return null;
  return {
    ...vip,
    _id: new mongoose.Types.ObjectId(vip.id),
  };
}

export function toVipJSON(vip) {
  if (!vip) return null;
  return {
    id: String(vip.id || vip._id),
    name: vip.name || "",
    slug: vip.slug || "",
    rank: vip.rank ?? 0,
    minSpend: vip.minSpend ?? 0,
    retainSpend: vip.retainSpend ?? 0,
    discountPercent: vip.discountPercent ?? 0,
    cashbackEvery: vip.cashbackEvery ?? 0,
    cashbackPoints: vip.cashbackPoints ?? 0,
    cashbackBonusDays: Array.isArray(vip.cashbackBonusDays)
      ? vip.cashbackBonusDays.map(Number)
      : [],
    cashbackBonusMultiplier: vip.cashbackBonusMultiplier ?? 1,
    description: vip.description || "",
    rules: Array.isArray(vip.rules) ? vip.rules.map(String) : [],
    benefits: Array.isArray(vip.benefits) ? vip.benefits.map(String) : [],
  };
}

export function defaultVip() {
  return requireVip(VIPS[0].id);
}

/** 一般會員（入會等級）沒有到期日。 */
export function isBaseVip(vip) {
  if (!vip) return true;
  if (vip.slug === "normal") return true;
  return (vip.rank ?? 1) <= 1;
}

/**
 * Tier kept when a membership year ends.
 * Walks from the current tier downward by each tier's retainSpend.
 */
export function vipRetainedBySpend(currentVip, periodSpend) {
  const current = getVipById(currentVip);
  const rank = current?.rank || 0;
  if (rank <= 1) return defaultVip();

  const amount = Math.max(0, Number(periodSpend) || 0);
  const kept = [...VIPS]
    .filter((vip) => vip.rank > 1 && vip.rank <= rank && Number(vip.retainSpend) > 0)
    .sort((a, b) => b.rank - a.rank)
    .find((vip) => amount >= Number(vip.retainSpend));

  return kept ? requireVip(kept.id) : defaultVip();
}

const CASHBACK_TIME_ZONE = "Asia/Taipei";

/** Day of month in Taipei. Null when `at` is missing or invalid. */
export function taipeiDayOfMonth(at) {
  const date = at ? new Date(at) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const day = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CASHBACK_TIME_ZONE,
      day: "numeric",
    }).format(date)
  );
  return Number.isInteger(day) ? day : null;
}

/** 2 on a tier's bonus day, otherwise 1. No date means no bonus. */
export function cashbackBonusMultiplier(vip, at) {
  const multiplier = Number(vip?.cashbackBonusMultiplier) || 1;
  const days = Array.isArray(vip?.cashbackBonusDays)
    ? vip.cashbackBonusDays.map(Number)
    : [];
  if (multiplier <= 1 || !days.length) return 1;
  const day = taipeiDayOfMonth(at);
  if (!days.includes(day)) return 1;
  return multiplier;
}

/** Points earned from a single purchase by VIP cashback rule. */
export function calcCashbackPoints(vip, spendAmount, at) {
  const every = Number(vip?.cashbackEvery) || 0;
  const points = Number(vip?.cashbackPoints) || 0;
  const amount = Number(spendAmount) || 0;
  if (every <= 0 || points <= 0 || amount < every) return 0;
  const base = Math.floor(amount / every) * points;
  return base * cashbackBonusMultiplier(vip, at);
}

/** Legacy helper. Daily VIP sync no longer keeps gold for 3 years. */
export function isGoldDowngradeProtected(user, { now = new Date() } = {}) {
  const lifetime = Math.max(0, Number(user?.totalSpend) || 0);
  if (lifetime < GOLD_PROTECT_MIN_LIFETIME_SPEND) return false;

  const end = getGoldProtectExpiresAt(user);
  if (!end) return false;

  return now.getTime() < end.getTime();
}
