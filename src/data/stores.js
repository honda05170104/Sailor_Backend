import mongoose from 'mongoose';

const DEFAULT_HOURS_LABEL = '營業時間';
const DEFAULT_HOURS = '13:00-22:00';

/** Fixed store list — not stored in MongoDB. Keep ids stable for transaction refs. */
export const STORES = [
  {
    id: '6a96ac0932cbbe5c8e26b42b',
    name: '水手兩棲爬蟲•異寵-台北店',
    address: '臺北市大同區鄰江里',
    phone: '02 2585 5883',
    lineUrl: 'https://lin.ee/nKeJvy2',
  },
  {
    id: '6ab374b9daf4b209977af834',
    name: '水手兩棲爬蟲•異寵-新北永和店',
    address: '新北市永和區保安里',
    phone: '02 2922 5585',
    lineUrl: 'https://lin.ee/y9T5YYa',
  },
  {
    id: '6ab374b9daf4b209977af835',
    name: '水手兩棲爬蟲•異寵-南港店',
    address: '南港路二段20巷5號B1',
    phone: '02 2651 2131',
    lineUrl: 'https://lin.ee/PBdBnkf',
  },
  {
    id: '6a96ac0f32cbbe5c8e26b432',
    name: '水手兩棲爬蟲•異寵-桃園店',
    address: '桃園市桃園區中寧里',
    phone: '03 215 1745',
    lineUrl: 'https://lin.ee/KY5mOAN',
  },
  {
    id: '6a96abff32cbbe5c8e26b41f',
    name: '水手兩棲爬蟲•異寵-台中',
    address: '台中市南屯區田心里五權西路二段380號',
    phone: '04 2475 0068',
    lineUrl: 'https://lin.ee/55Zo3S2',
  },
  {
    id: '6ab374b9daf4b209977af836',
    name: '水手兩棲爬蟲•異寵-彰化田尾店',
    address: '彰化縣田尾鄉中山路一段217號',
    phone: '04 883 6682',
    hoursLabel: '營業日期',
    hours: '本店採不定期公休，建議到訪前確認',
    lineUrl: 'https://lin.ee/tvY9Teu',
  },
  {
    id: '6ab374b9daf4b209977af837',
    name: '水手兩棲爬蟲•異寵-台南',
    address: '臺南市安南區鳳凰里北安路三段179號',
    phone: '06 245 0255',
    lineUrl: 'https://lin.ee/UBL2twj',
  },
  {
    id: '6ab374b9daf4b209977af838',
    name: '水手兩棲爬蟲•異寵-高雄',
    address: '高雄市鼓山區龍水里明誠四路112號1F',
    phone: '07 586 6090',
    lineUrl: 'https://lin.ee/haZB1yM',
  },
].map((store) => ({
  hoursLabel: DEFAULT_HOURS_LABEL,
  hours: DEFAULT_HOURS,
  ...store,
}));

const storeById = new Map(STORES.map((store) => [String(store.id), store]));

export function listStores() {
  return STORES.map(toStoreJSON);
}

export function getStoreById(id) {
  if (id == null) return null;
  if (typeof id === 'object' && id.name != null && id.id != null) {
    return toStoreJSON(id);
  }
  return storeById.get(String(id?._id || id)) || null;
}

export function requireStore(id) {
  const store = getStoreById(id);
  if (!store) return null;
  return {
    ...store,
    _id: new mongoose.Types.ObjectId(store.id),
  };
}

export function toStoreJSON(store) {
  if (!store) return null;
  return {
    id: String(store.id || store._id),
    name: store.name || '',
    address: store.address || '',
    phone: store.phone || '',
    lineUrl: store.lineUrl || '',
    hoursLabel: store.hoursLabel || '',
    hours: store.hours || '',
  };
}

export function defaultStore() {
  return requireStore(STORES[0].id);
}
