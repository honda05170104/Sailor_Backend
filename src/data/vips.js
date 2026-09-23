import mongoose from "mongoose";

/** Fixed VIP tiers — not stored in MongoDB. Keep ids stable for user.vip refs.
 *  minSpend = rolling 1-year spend threshold. */
export const VIPS = [
  {
    id: "6a96b19f24ebb49b9046b616",
    name: "一般會員",
    slug: "normal",
    rank: 1,
    minSpend: 0,
    discountPercent: 0,
    /** Points cashback: every `cashbackEvery` spend → `cashbackPoints`. 0 = none. */
    cashbackEvery: 0,
    cashbackPoints: 0,
    description: "入會會員。",
    benefits: ["註冊即贈送 50 元優惠券"],
  },
  {
    id: "6a96b19f24ebb49b9046b617",
    name: "金卡",
    slug: "gold",
    rank: 2,
    minSpend: 3500,
    discountPercent: 0,
    cashbackEvery: 300,
    cashbackPoints: 1,
    description: "近一年累積消費滿 3,500 元。",
    benefits: [
      "近一年累積消費滿 3,500 元",
      "舊會員（已消費滿 100 元）：三年內不會降級",
      "用品類 85 折（活體、餌料、缸除外）",
      "單筆消費滿 300 元，點數回饋 1 點",
      "升等禮 100 元優惠券",
      "生日禮 100 元優惠券",
      "寄宿動物一天折 50 元",
    ],
  },
  {
    id: "6a96b19f24ebb49b9046b618",
    name: "黑卡",
    slug: "black",
    rank: 3,
    minSpend: 12000,
    discountPercent: 0,
    cashbackEvery: 200,
    cashbackPoints: 1,
    description: "近一年累積消費滿 12,000 元。",
    benefits: [
      "近一年累積消費滿 12,000 元",
      "用品類 75 折（活體、餌料、缸除外）",
      "生日禮 500 元優惠券",
      "單筆消費滿 200 元，點數回饋 1 點",
      "升等禮 300 元優惠券",
      "寄宿動物免費",
      "黑卡專屬社群",
      "不定期提供品牌活動",
    ],
  },
];

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
    discountPercent: vip.discountPercent ?? 0,
    cashbackEvery: vip.cashbackEvery ?? 0,
    cashbackPoints: vip.cashbackPoints ?? 0,
    description: vip.description || "",
    benefits: Array.isArray(vip.benefits) ? vip.benefits.map(String) : [],
  };
}

export function defaultVip() {
  return requireVip(VIPS[0].id);
}

/** Points earned from a single purchase by VIP cashback rule. */
export function calcCashbackPoints(vip, spendAmount) {
  const every = Number(vip?.cashbackEvery) || 0;
  const points = Number(vip?.cashbackPoints) || 0;
  const amount = Number(spendAmount) || 0;
  if (every <= 0 || points <= 0 || amount < every) return 0;
  return Math.floor(amount / every) * points;
}

/** Old members with lifetime spend >= 100 get 3-year protection from falling below gold. */
export function isGoldDowngradeProtected(user, { now = new Date() } = {}) {
  const lifetime = Math.max(0, Number(user?.totalSpend) || 0);
  if (lifetime < GOLD_PROTECT_MIN_LIFETIME_SPEND) return false;

  const end = getGoldProtectExpiresAt(user);
  if (!end) return false;

  return now.getTime() < end.getTime();
}
