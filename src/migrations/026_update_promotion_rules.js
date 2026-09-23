import { ObjectId } from 'mongodb';

/** Apply current VIP coupon / promotion amounts (join 50, gold 100, black 300, birthday 600). */
const PROMOTION_COUPONS = [
  {
    id: '7a96b19f24ebb49b9046b701',
    name: '入會禮｜折抵 $50',
    description: '歡迎加入水手！新會員註冊即贈，無低消。',
    type: 'amount',
    value: 50,
    minSpend: 0,
    expiryMode: 'relative',
    expireDays: 60,
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b702',
    name: '金卡升等禮｜折抵 $100',
    description: '升等至金卡時發放，每個等級一次。',
    type: 'amount',
    value: 100,
    minSpend: 0,
    expiryMode: 'relative',
    expireDays: 60,
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b704',
    name: '黑卡升等禮｜折抵 $300',
    description: '升等至黑卡時發放，每個等級一次。',
    type: 'amount',
    value: 300,
    minSpend: 0,
    expiryMode: 'relative',
    expireDays: 60,
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b703',
    name: '黑卡生日禮｜折抵 $600',
    description: '黑卡會員專屬，生日當月 1 號自動發放，無低消。',
    type: 'amount',
    value: 600,
    minSpend: 0,
    expiryMode: 'relative',
    expireDays: 30,
    enabled: true,
  },
];

const PROMOTIONS = [
  {
    id: '7a96b19f24ebb49b9046b711',
    key: 'join',
    type: 'join',
    name: '入會禮',
    description: '首次以 LINE 加入會員時自動發放 50 元折價券。',
    couponId: '7a96b19f24ebb49b9046b701',
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b715',
    key: 'upgrade-gold',
    type: 'upgrade',
    name: '金卡升等禮',
    description: '近一年累積消費滿 3,500 元升等金卡時發放 100 元折價券。',
    couponId: '7a96b19f24ebb49b9046b702',
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b714',
    key: 'upgrade-black',
    type: 'upgrade',
    name: '黑卡升等禮',
    description: '近一年累積消費滿 12,000 元升等黑卡時發放 300 元折價券。',
    couponId: '7a96b19f24ebb49b9046b704',
    enabled: true,
  },
  {
    id: '7a96b19f24ebb49b9046b713',
    key: 'birthday',
    type: 'birthday',
    name: '黑卡生日禮',
    description: '黑卡會員生日當月 1 號凌晨自動發放 600 元折價券，每年一次。',
    couponId: '7a96b19f24ebb49b9046b703',
    enabled: true,
  },
];

export default {
  name: '026_update_promotion_rules',
  async up(db) {
    const now = new Date();

    for (const seed of PROMOTION_COUPONS) {
      await db.collection('coupons').updateOne(
        { _id: new ObjectId(seed.id) },
        {
          $set: {
            name: seed.name,
            description: seed.description || '',
            type: seed.type,
            value: seed.value,
            minSpend: seed.minSpend ?? 0,
            expiryMode: seed.expiryMode || 'relative',
            expireDays: seed.expireDays ?? 30,
            startsAt: null,
            endsAt: null,
            enabled: seed.enabled !== false,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }

    for (const seed of PROMOTIONS) {
      await db.collection('promotions').updateOne(
        { key: seed.key },
        {
          $set: {
            type: seed.type,
            name: seed.name,
            description: seed.description || '',
            coupon: new ObjectId(seed.couponId),
            enabled: seed.enabled !== false,
            updatedAt: now,
          },
          $setOnInsert: {
            _id: new ObjectId(seed.id),
            key: seed.key,
            createdAt: now,
          },
        },
        { upsert: true }
      );
    }

    // Legacy single upgrade promotion — replaced by upgrade-gold / upgrade-black.
    await db.collection('promotions').updateOne(
      { key: 'upgrade' },
      { $set: { enabled: false, updatedAt: now } }
    );
  },
};
