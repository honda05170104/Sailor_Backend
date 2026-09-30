import AppError from '../utils/AppError.js';
import { ErrorCode } from '../constants/codes.js';

const LINE_MULTICAST_URL = 'https://api.line.me/v2/bot/message/multicast';
const MULTICAST_LIMIT = 500;

function channelAccessToken() {
  const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (!token) {
    throw new AppError(
      'LINE messaging is not configured',
      ErrorCode.INTERNAL_SERVER_ERROR
    );
  }
  return token;
}

function chunks(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

/** Send the same messages to LINE user ids. Ids that have not added the official account are skipped by LINE. */
export async function multicastMessages(lineUserIds, messages) {
  const ids = [...new Set(lineUserIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length || !Array.isArray(messages) || !messages.length) return { sent: 0 };

  const token = channelAccessToken();
  let sent = 0;

  for (const group of chunks(ids, MULTICAST_LIMIT)) {
    const res = await fetch(LINE_MULTICAST_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: group,
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body?.message || `LINE ${res.status}`;
      console.log('LINE API 錯誤回應:', {
        status: res.status,
        statusText: res.statusText,
        body,
        group,
        messages: JSON.stringify(messages, null, 2)
      });
      throw new AppError(
        sent
          ? `已送出 ${sent} 人，其餘失敗：${detail}`
          : `LINE 發送失敗：${detail}`,
        ErrorCode.BAD_REQUEST
      );
    }

    const responseBody = await res.json().catch(() => ({}));
    console.log('LINE API 成功回應:', {
      status: res.status,
      body: responseBody,
      sentTo: group,
      messageCount: messages.length
    });

    sent += group.length;
  }

  return { sent };
}

/** Send the same text to LINE user ids. Ids that have not added the official account are skipped by LINE. */
export async function multicastText(lineUserIds, text) {
  const message = String(text || '');
  if (!message) return { sent: 0 };
  return multicastMessages(lineUserIds, [{ type: 'text', text: message }]);
}

/** Create a coupon flex message for LINE - 原生格式 */
export function createCouponFlexMessage(coupon, brandName = '水手') {
  const valueText = coupon.type === 'percent' 
    ? `${coupon.value}% 折扣` 
    : `NT$ ${coupon.value}`;
  const minSpendText = coupon.minSpend > 0 ? `滿 NT$ ${coupon.minSpend} 可用` : '無門檻限制';
  
  return {
    "type": "flex",
    "altText": `${brandName} 優惠券通知`,
    "contents": {
      "type": "bubble",
      "header": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "image",
            "url": "https://d3308oqn2orcoj.cloudfront.net/assets/1790766481348-c79b601b4c11a0c9.png",
            "size": "120px",
            "align": "center"
          },
        ],
        "backgroundColor": "#000000",
        "paddingAll": "20px"
      },
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "margin": "lg",
            "spacing": "md",
            "contents": [
              {
                "type": "box",
                "layout": "baseline",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "text",
                    "text": "優惠券名稱",
                    "color": "#666666",
                    "size": "sm",
                    "flex": 3
                  },
                  {
                    "type": "text",
                    "text": coupon.name,
                    "wrap": true,
                    "color": "#333333",
                    "size": "sm",
                    "flex": 7,
                    "weight": "bold"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "text",
                    "text": "優惠面額",
                    "color": "#666666",
                    "size": "sm",
                    "flex": 3
                  },
                  {
                    "type": "text",
                    "text": valueText,
                    "wrap": true,
                    "color": "#e74c3c",
                    "size": "lg",
                    "flex": 7,
                    "weight": "bold"
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "text",
                    "text": "使用條件",
                    "color": "#666666",
                    "size": "sm",
                    "flex": 3
                  },
                  {
                    "type": "text",
                    "text": minSpendText,
                    "wrap": true,
                    "color": "#333333",
                    "size": "sm",
                    "flex": 7
                  }
                ]
              },
              {
                "type": "box",
                "layout": "baseline",
                "spacing": "sm",
                "contents": [
                  {
                    "type": "text",
                    "text": "有效期限",
                    "color": "#666666",
                    "size": "sm",
                    "flex": 3
                  },
                  {
                    "type": "text",
                    "text": "30天內使用",
                    "wrap": true,
                    "color": "#333333",
                    "size": "sm",
                    "flex": 7
                  }
                ]
              }
            ]
          },
        ],
        "paddingAll": "20px"
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "spacing": "sm",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "height": "sm",
            "color": "#000000",
            "action": {
              "type": "uri",
              "label": "查看我的優惠券",
              "uri": "https://liff.line.me/2011362315-tc7Scs3h/coupons"
            }
          }
        ],
        "paddingAll": "15px"
      }
    }
  };
}

/** Send coupon notification with flex message */
export async function multicastCoupon(lineUserIds, coupon, message = '') {
  const messages = [];
  
  if (message) {
    messages.push({ type: 'text', text: message });
  }
  
  messages.push(createCouponFlexMessage(coupon));
  
  return multicastMessages(lineUserIds, messages);
}
