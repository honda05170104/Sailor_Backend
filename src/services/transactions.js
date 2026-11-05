import crypto from 'crypto';

export const TRANSACTION_ORDER_STATUSES = ['completed'];

export const TRANSACTION_ORDER_STATUS_LABELS = {
  completed: '已完成',
};

export const DEFAULT_TRANSACTION_ORDER_STATUS = 'completed';

/** Normalize free-text / legacy statuses into the enum. */
export function normalizeOrderStatus(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();

  if (!raw) return DEFAULT_TRANSACTION_ORDER_STATUS;

  if (TRANSACTION_ORDER_STATUSES.includes(raw)) return raw;

  // Legacy Chinese / free-text → completed (current product rule).
  if (
    raw === 'completed' ||
    raw === '已完成' ||
    raw === '已調整' ||
    raw === 'done' ||
    raw === 'success'
  ) {
    return 'completed';
  }

  return DEFAULT_TRANSACTION_ORDER_STATUS;
}

export function orderStatusLabel(value) {
  const status = normalizeOrderStatus(value);
  return (
    TRANSACTION_ORDER_STATUS_LABELS[status] ||
    TRANSACTION_ORDER_STATUS_LABELS.completed
  );
}

const POS_ORDER_NO_RE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;

/**
 * POS order numbers encode the original sale time as YYYYMMDD-HHMMSS
 * in Asia/Taipei. Returns null when the number is not that format.
 */
export function orderTimeFromOrderNo(orderNo) {
  const match = String(orderNo || '').trim().match(POS_ORDER_NO_RE);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`);
  if (Number.isNaN(date.getTime())) return null;

  const formatted = date.toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    hourCycle: 'h23',
  });
  if (formatted !== `${year}-${month}-${day} ${hour}:${minute}:${second}`) return null;
  return date;
}

/** Sale time for a transaction. POS rows use the order number; others use fallback. */
export function resolveOrderedAt(orderNo, fallback = new Date()) {
  return orderTimeFromOrderNo(orderNo) || fallback;
}

/** When the sale happened. Import time is not a business date. */
export function saleAt(record, fallback = new Date()) {
  const value = record?.orderedAt || record?.createdAt;
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? new Date(fallback) : date;
}

/** Sailor's own order number (not the imported POS order no). */
export function generateTxnNo(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `S${y}${m}${d}${hh}${mm}${ss}${rand}`;
}
