/** POS line-item names that trigger import logic. Must match the POS export exactly. */
export const PosItem = Object.freeze({
  /** Welcome coupon used in store: record the join coupon as used. */
  JOIN_GIFT: '新客入會禮',
  /** Legacy member converted in store: upgrade to black. */
  LEGACY_TO_BLACK: '舊會員轉黑卡',
  /** Points used or added in store: line subtotal adjusts stored points. */
  POINT_DISCOUNT: '點數折扣',
});

export function isPosItem(item, name) {
  return String(item?.name || '').trim() === name;
}

export function orderHasPosItem(order, name) {
  return (order?.items || []).some((item) => isPosItem(item, name));
}
