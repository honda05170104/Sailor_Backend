import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { ErrorCode } from '../../constants/codes.js';
import { multicastText, multicastCoupon } from '../../services/lineMessaging.js';
import { buildMemberFilter } from './member.service.js';
import Coupon from '../../models/Coupon.js';

const TEXT_LIMIT = 5000;

export async function broadcastMessage({ q, line, vip, text, userIds } = {}) {
  const message = String(text || '').trim();
  
  if (!message) {
    throw new AppError(
      { field: 'text', message: '請輸入訊息內容' },
      ErrorCode.BAD_REQUEST
    );
  }
  
  if (message.length > TEXT_LIMIT) {
    throw new AppError(
      { field: 'text', message: `訊息最多 ${TEXT_LIMIT} 字` },
      ErrorCode.BAD_REQUEST
    );
  }

  let lineUserIds = [];
  let skipped = 0;
  let matched = 0;

  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    // Direct LINE user IDs provided
    lineUserIds = userIds
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    matched = lineUserIds.length;
    skipped = 0;
  } else {
    // Query-based filtering
    const users = await User.find(buildMemberFilter(q, line, vip))
      .select('lineUserId')
      .lean();
    lineUserIds = users
      .map((user) => String(user.lineUserId || '').trim())
      .filter(Boolean);
    matched = users.length;
    skipped = users.length - lineUserIds.length;
  }

  if (!lineUserIds.length) {
    throw new AppError('沒有可發送的會員', ErrorCode.BAD_REQUEST);
  }

  const result = await multicastText(lineUserIds, message);
  
  return {
    matched,
    sent: result.sent,
    skipped,
  };
}

export async function broadcastCoupon({ q, line, vip, couponId, userIds } = {}) {
  if (!couponId) {
    throw new AppError(
      { field: 'couponId', message: '請選擇優惠券' },
      ErrorCode.BAD_REQUEST
    );
  }

  // 驗證優惠券存在
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    throw new AppError('優惠券不存在', ErrorCode.NOT_FOUND);
  }

  let lineUserIds = [];
  let skipped = 0;
  let matched = 0;

  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    // Direct LINE user IDs provided
    lineUserIds = userIds
      .map((id) => String(id || '').trim())
      .filter(Boolean);
    matched = lineUserIds.length;
    skipped = 0;
  } else {
    // Query-based filtering
    const users = await User.find(buildMemberFilter(q, line, vip))
      .select('lineUserId')
      .lean();
    lineUserIds = users
      .map((user) => String(user.lineUserId || '').trim())
      .filter(Boolean);
    matched = users.length;
    skipped = users.length - lineUserIds.length;
  }

  if (!lineUserIds.length) {
    throw new AppError('沒有可發送的會員', ErrorCode.BAD_REQUEST);
  }

  const result = await multicastCoupon(lineUserIds, coupon.toSafeJSON(), `您收到新的優惠券：${coupon.name}`);
  
  return {
    matched,
    sent: result.sent,
    skipped,
    couponName: coupon.name,
  };
}
