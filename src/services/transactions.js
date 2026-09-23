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
