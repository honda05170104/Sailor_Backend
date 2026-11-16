import mongoose from "mongoose";

/** 0=Sun … 6=Sat, matching JS getDay() / Asia/Taipei wall clock. */
const WEEKDAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const WEEKDAY_SHORT = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Fixed VIP tiers — not stored in MongoDB. Keep ids stable for user.vip refs.
 *  singleSpend = one purchase that unlocks this tier.
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
    singleSpend: 0,
    retainSpend: 0,
    discountPercent: 0,
    /** Points cashback: every `cashbackEvery` spend → `cashbackPoints`. 0 = none. */
    cashbackEvery: 100,
    cashbackPoints: 1,
    /** Taipei weekdays (0=Sun … 6=Sat) when cashback points are multiplied. */
    cashbackBonusWeekdays: [4],
    cashbackBonusMultiplier: 2,
    description: "註冊即為一般會員。",
    /** Welcome coupon, issued once on join. */
    joinGift: 50,
    perks: [],
  },
  {
    id: "6a96b19f24ebb49b9046b617",
    name: "金卡",
    slug: "gold",
    rank: 2,
    minSpend: 4888,
    singleSpend: 2888,
    retainSpend: 4888,
    discountPercent: 0,
    cashbackEvery: 100,
    cashbackPoints: 1,
    cashbackBonusWeekdays: [4],
    cashbackBonusMultiplier: 2,
    /** Coupon issued once when the member reaches this tier. */
    upgradeGift: 100,
    /** Coupon issued once per year, on the 1st of the birthday month. */
    birthdayGift: 100,
    /** Where the birthday line sits in the member-facing benefit list. */
    birthdayGiftAt: "after",
    perksBeforePoints: ["享有會員價"],
    perksAfterPoints: [
      "寄宿動物一天折 50 元",
      "根據消費品項不定時發送折價券",
    ],
  },
  {
    id: "6a96b19f24ebb49b9046b618",
    name: "黑卡",
    slug: "black",
    rank: 3,
    minSpend: 10000,
    singleSpend: 8888,
    retainSpend: 10000,
    discountPercent: 0,
    cashbackEvery: 100,
    cashbackPoints: 1,
    cashbackBonusWeekdays: [4],
    cashbackBonusMultiplier: 3,
    upgradeGift: 200,
    birthdayGift: 200,
    birthdayGiftAt: "after",
    perksBeforePoints: ["享有會員價"],
    perksAfterPoints: [
      "一年內寄宿動物 5 天免費",
      "黑卡專屬社群（稀有物種預購權、專屬特惠、玩家交流）",
      "不定期提供品牌活動",
      "根據消費品項不定時發送折價券",
      "寵物生日回娘家（每年生日可領一份）",
    ],
  },
];

/** 1 point redeems as 1 yuan. */
export const POINT_YUAN = 1;

/** Days after issue before a VIP gift coupon expires. */
export const VIP_GIFT_EXPIRE_DAYS = {
  join: 60,
  upgrade: 60,
  birthday: 30,
};

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

function qualifiesBySpend(vip, yearSpend = 0, maxSingle = 0) {
  const year = Math.max(0, Number(yearSpend) || 0);
  const single = Math.max(0, Number(maxSingle) || 0);
  const minSpend = Number(vip?.minSpend) || 0;
  const singleSpend = Number(vip?.singleSpend) || 0;
  if (minSpend > 0 && year >= minSpend) return true;
  if (singleSpend > 0 && single >= singleSpend) return true;
  return minSpend <= 0 && singleSpend <= 0 && (vip?.rank || 0) <= 1;
}

/** Upgrade / retain lines. Numbers come from the tier fields. */
export function vipSpendLines(vip, lower = null) {
  if (!vip) return [];
  const hasSingle = Number(vip.singleSpend) > 0;
  const hasYear = Number(vip.minSpend) > 0;
  if (!hasSingle && !hasYear) return [];

  const lines = [];
  if (hasSingle && hasYear) {
    lines.push(
      `單筆消費滿 ${formatMoney(vip.singleSpend)} 元，或近一年累積消費滿 ${formatMoney(vip.minSpend)} 元升等`
    );
  } else if (hasSingle) {
    lines.push(`單筆消費滿 ${formatMoney(vip.singleSpend)} 元升等`);
  } else if (hasYear) {
    lines.push(`近一年累積消費滿 ${formatMoney(vip.minSpend)} 元升等`);
  }
  if (!(Number(vip.retainSpend) > 0)) return lines;

  lines.push(`會級期間消費滿 ${formatMoney(vip.retainSpend)} 元保留${vip.name}`);
  if (lower && Number(vip.retainSpend) > Number(lower.retainSpend)) {
    lines.push(
      `會級期間滿 ${formatMoney(lower.retainSpend)} 元、未滿 ${formatMoney(vip.retainSpend)} 元改為${lower.name}`
    );
  }
  const floor =
    lower && Number(lower.retainSpend) > 0
      ? Number(lower.retainSpend)
      : Number(vip.retainSpend);
  lines.push(`會級期間未滿 ${formatMoney(floor)} 元，到期後退回一般會員`);
  return lines;
}

function pointLines(vip) {
  if (!(Number(vip.cashbackEvery) > 0) || !(Number(vip.cashbackPoints) > 0)) {
    return [];
  }
  const lines = [
    `單筆消費滿 ${formatMoney(vip.cashbackEvery)} 元回饋 ${vip.cashbackPoints} 點`,
    `${POINT_YUAN} 點對應 ${POINT_YUAN} 元`,
  ];
  const weekdays = Array.isArray(vip.cashbackBonusWeekdays)
    ? vip.cashbackBonusWeekdays.map(Number)
    : [];
  const multiplier = Number(vip.cashbackBonusMultiplier) || 1;
  if (weekdays.length && multiplier > 1) {
    const labels = weekdays
      .map((day) => WEEKDAY_LABELS[day] || "")
      .filter(Boolean);
    if (labels.length) {
      lines.push(`每${labels.join("、")} 點數 ${multiplier} 倍送`);
    }
  }
  return lines;
}

function decorateVip(def) {
  const lower = previousPaidTier(def);
  const rules = vipSpendLines(def, lower);
  const before = [...(def.perksBeforePoints || [])];
  const after = [...(def.perksAfterPoints || [])];
  const perks = [...(def.perks || [])];
  if (Number(def.upgradeGift) > 0) {
    before.push(`${def.name}升等禮 ${formatMoney(def.upgradeGift)} 元優惠券`);
  }
  if (Number(def.birthdayGift) > 0) {
    const line = `生日禮 ${formatMoney(def.birthdayGift)} 元優惠券`;
    if (def.birthdayGiftAt === "before") before.push(line);
    else after.unshift(line);
  }
  if (Number(def.joinGift) > 0) {
    perks.unshift(`註冊即享 ${formatMoney(def.joinGift)}元 優惠券`);
  }
  const benefits = [...before, ...pointLines(def), ...after, ...perks];
  const description = rules.length
    ? `${rules.join("。")}。`
    : def.description || "";
  return { ...def, description, rules, benefits };
}

export const VIPS = VIP_DEFS.map(decorateVip);

function upgradeThresholdCopy(vip) {
  const parts = [];
  if (Number(vip.singleSpend) > 0) {
    parts.push(`單筆消費滿 ${formatMoney(vip.singleSpend)} 元`);
  }
  if (Number(vip.minSpend) > 0) {
    parts.push(`近一年累積消費滿 ${formatMoney(vip.minSpend)} 元`);
  }
  return parts.join("，或");
}

/** Join / upgrade / birthday coupons. Amounts and expiry come from this file. */
export function vipGiftPromotions() {
  const gifts = [];
  const push = (gift) => {
    gifts.push({
      ...gift,
      expireDays: VIP_GIFT_EXPIRE_DAYS[gift.type],
    });
  };
  for (const vip of VIPS) {
    if (Number(vip.joinGift) > 0) {
      const amount = Number(vip.joinGift);
      push({
        key: "join",
        type: "join",
        amount,
        couponName: `入會禮｜折抵 $${formatMoney(amount)}`,
        couponDescription: "歡迎加入水手！新會員註冊即贈，無低消。",
        promotionName: "入會禮",
        promotionDescription: `註冊成為會員時自動發放 ${formatMoney(amount)} 元優惠券。`,
      });
    }
    if (Number(vip.upgradeGift) > 0) {
      const amount = Number(vip.upgradeGift);
      const threshold = upgradeThresholdCopy(vip);
      push({
        key: `upgrade-${vip.slug}`,
        type: "upgrade",
        amount,
        couponName: `${vip.name}升等禮｜折抵 $${formatMoney(amount)}`,
        couponDescription: `升等至${vip.name}時發放，每個等級一次。`,
        promotionName: `${vip.name}升等禮`,
        promotionDescription: `${threshold}升等${vip.name}時發放 ${formatMoney(amount)} 元優惠券。`,
      });
    }
    if (Number(vip.birthdayGift) > 0) {
      const amount = Number(vip.birthdayGift);
      push({
        key: `birthday-${vip.slug}`,
        type: "birthday",
        amount,
        couponName: `${vip.name}生日禮｜折抵 $${formatMoney(amount)}`,
        couponDescription: `${vip.name}會員專屬，生日當月 1 號自動發放，無低消。`,
        promotionName: `${vip.name}生日禮`,
        promotionDescription: `${vip.name}會員生日當月 1 號凌晨自動發放 ${formatMoney(amount)} 元優惠券，每年一次。`,
      });
    }
  }
  return gifts;
}

export function vipGiftPromotion(key) {
  return vipGiftPromotions().find((gift) => gift.key === key) || null;
}

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
    singleSpend: vip.singleSpend ?? 0,
    retainSpend: vip.retainSpend ?? 0,
    discountPercent: vip.discountPercent ?? 0,
    cashbackEvery: vip.cashbackEvery ?? 0,
    cashbackPoints: vip.cashbackPoints ?? 0,
    cashbackBonusWeekdays: Array.isArray(vip.cashbackBonusWeekdays)
      ? vip.cashbackBonusWeekdays.map(Number)
      : [],
    cashbackBonusMultiplier: vip.cashbackBonusMultiplier ?? 1,
    joinGift: vip.joinGift ?? 0,
    upgradeGift: vip.upgradeGift ?? 0,
    birthdayGift: vip.birthdayGift ?? 0,
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

/** Weekday in Taipei (0=Sun … 6=Sat). Null when `at` is missing or invalid. */
export function taipeiWeekday(at) {
  const date = at ? new Date(at) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: CASHBACK_TIME_ZONE,
    weekday: "short",
  }).format(date);
  const weekday = WEEKDAY_SHORT[label];
  return Number.isInteger(weekday) ? weekday : null;
}

/** Multiplier on a tier's bonus weekday, otherwise 1. No date means no bonus. */
export function cashbackBonusMultiplier(vip, at) {
  const multiplier = Number(vip?.cashbackBonusMultiplier) || 1;
  const weekdays = Array.isArray(vip?.cashbackBonusWeekdays)
    ? vip.cashbackBonusWeekdays.map(Number)
    : [];
  if (multiplier <= 1 || !weekdays.length) return 1;
  const weekday = taipeiWeekday(at);
  if (!weekdays.includes(weekday)) return 1;
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

/** Highest VIP tier unlocked by rolling-year spend and/or max single purchase. */
export function vipForSpend(spend = 0, maxSingle = 0) {
  const sorted = [...VIPS].sort(
    (a, b) => b.rank - a.rank || b.minSpend - a.minSpend
  );
  const vip =
    sorted.find((item) => qualifiesBySpend(item, spend, maxSingle)) || VIPS[0];
  return requireVip(vip.id);
}

/** Legacy helper. Daily VIP sync no longer keeps gold for 3 years. */
export function isGoldDowngradeProtected(user, { now = new Date() } = {}) {
  const lifetime = Math.max(0, Number(user?.totalSpend) || 0);
  if (lifetime < GOLD_PROTECT_MIN_LIFETIME_SPEND) return false;

  const end = getGoldProtectExpiresAt(user);
  if (!end) return false;

  return now.getTime() < end.getTime();
}
