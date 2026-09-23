window.Manager = window.Manager || (function () {
const TOKEN_KEY = "managerToken";
const LOGIN_PATH = "/manager/";
const HOME_PATH = "/members";

let toastTimer = 0;
let toastHideTimer = 0;

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function showToast(message, type = "success") {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", type === "error");
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    toastHideTimer = setTimeout(() => el.classList.add("hidden"), 200);
  }, 2400);
}

async function api(path, options = {}) {
  const { toast: toastOpt, ...fetchOptions } = options;
  const headers = { ...(fetchOptions.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (fetchOptions.body && !(fetchOptions.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const method = String(fetchOptions.method || "GET").toUpperCase();
  const res = await fetch(`/api/v1/manager${path}`, { ...fetchOptions, headers });
  const json = await res.json();
  if (!res.ok) {
    const message = json?.error?.data?.[0]?.message || "Request failed";
    if (method === "POST" && toastOpt !== false) {
      showToast(message, "error");
    }
    throw new Error(message);
  }
  if (method === "POST" && toastOpt !== false) {
    showToast(typeof toastOpt === "string" ? toastOpt : "操作成功");
  }
  return json.data;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fillWho(manager) {
  const who = document.getElementById("who");
  if (who && manager) {
    who.textContent = `${manager.name || manager.username}（${manager.type}）`;
  }
}

function bindLogout() {
  const btn = document.getElementById("logout-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await api("/logout", { method: "POST", toast: false });
    } catch {
      /* still leave */
    }
    clearToken();
    location.replace(LOGIN_PATH);
  });
}

function bindModalDismiss(modal, closeFn) {
  if (!modal) return;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeFn();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (modal.classList.contains("hidden")) return;
    event.preventDefault();
    closeFn();
  });
}

async function requireAuth() {
  bindLogout();

  if (!getToken()) {
    location.replace(LOGIN_PATH);
    return null;
  }

  try {
    const data = await api("/me");
    fillWho(data.manager);
    bindLogout();
    return data.manager;
  } catch {
    clearToken();
    location.replace(LOGIN_PATH);
    return null;
  }
}

const BRANCH_TYPE_LABELS = {
  Directly: "直營",
  Corporate: "企業",
  Department: "專櫃",
};

const COUPON_TYPE_LABELS = {
  amount: "折抵金額",
  percent: "折扣 %",
};

const COUPON_CATEGORY_LABELS = {
  general: "一般",
  upgrade: "升等禮",
  birthday: "生日禮",
};

const COUPON_STATUS_LABELS = {
  available: "未使用",
  used: "已使用",
  expired: "已過期",
};

const COUPON_SOURCE_LABELS = {
  manual: "手動發放",
  promotion: "優惠活動",
};

function branchTypeLabel(type) {
  return BRANCH_TYPE_LABELS[type] || type || "—";
}

function branchName(tx) {
  if (tx?.branch && typeof tx.branch === "object") {
    return tx.branch.name || "—";
  }
  return "—";
}

function couponTypeLabel(type) {
  return COUPON_TYPE_LABELS[type] || type || "—";
}

function couponCategoryLabel(category) {
  return COUPON_CATEGORY_LABELS[category] || COUPON_CATEGORY_LABELS.general;
}

function couponValueText(coupon) {
  const value = coupon.value ?? 0;
  if (coupon.type === "percent") return `${value}%`;
  return `${value} 元`;
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function couponExpiryText(coupon) {
  if (!coupon) return "—";
  if (coupon.expiryMode === "relative") {
    return coupon.expireDays ? `發放後 ${coupon.expireDays} 天` : "發放後到期";
  }
  const start = toDateInput(coupon.startsAt);
  const end = toDateInput(coupon.endsAt);
  if (start && end) return `${start} ~ ${end}`;
  if (end) return `至 ${end}`;
  return "固定到期日";
}

function couponSourceLabel(coupon) {
  if (!coupon) return "—";
  if (coupon.sourceLabel) return coupon.sourceLabel;
  const source = coupon.source || "manual";
  const base = COUPON_SOURCE_LABELS[source] || source;
  if (source === "promotion" && coupon.promotionName) {
    return `${base}（${coupon.promotionName}）`;
  }
  return base;
}

function formatDay(value) {
  return toDateInput(value) || "—";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-TW");
}

function enabledText(enabled) {
  return enabled === false ? "停用" : "啟用";
}

function vipName(user) {
  return user.vip?.name || user.vipTier || "—";
}

function isLineLinked(user) {
  return Boolean(user.lineLinked || user.lineUserId);
}

function lineStatusHtml(user) {
  return isLineLinked(user)
    ? '<span class="status status-on">已開通</span>'
    : '<span class="status status-off">未開通</span>';
}

const NAV_GROUP_KEY = "managerNavGroups";

function readNavGroupState() {
  try {
    return JSON.parse(localStorage.getItem(NAV_GROUP_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeNavGroupState(state) {
  localStorage.setItem(NAV_GROUP_KEY, JSON.stringify(state));
}

function bindNavGroups() {
  const state = readNavGroupState();

  document.querySelectorAll("aside .nav-group").forEach((group, index) => {
    const title = group.querySelector(".nav-group-title");
    if (!title) return;

    const key = group.dataset.navKey || title.textContent.trim() || `group-${index}`;
    group.dataset.navKey = key;

    const hasActive = Boolean(group.querySelector("a.active"));
    const collapsed =
      hasActive ? false : state[key] === undefined ? false : Boolean(state[key]);
    group.classList.toggle("is-collapsed", collapsed);
    title.setAttribute("aria-expanded", collapsed ? "false" : "true");

    if (title.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = title.className;
      button.textContent = title.textContent;
      button.setAttribute("aria-expanded", title.getAttribute("aria-expanded"));
      title.replaceWith(button);
    }

    const btn = group.querySelector(".nav-group-title");
    btn.addEventListener("click", () => {
      const next = !group.classList.contains("is-collapsed");
      group.classList.toggle("is-collapsed", next);
      btn.setAttribute("aria-expanded", next ? "false" : "true");
      const latest = readNavGroupState();
      latest[key] = next;
      writeNavGroupState(latest);
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindNavGroups);
} else {
  bindNavGroups();
}

return {
  TOKEN_KEY,
  LOGIN_PATH,
  HOME_PATH,
  BRANCH_TYPE_LABELS,
  COUPON_TYPE_LABELS,
  COUPON_CATEGORY_LABELS,
  COUPON_STATUS_LABELS,
  COUPON_SOURCE_LABELS,
  getToken,
  setToken,
  clearToken,
  showToast,
  api,
  escapeHtml,
  fillWho,
  bindLogout,
  bindModalDismiss,
  bindNavGroups,
  requireAuth,
  branchTypeLabel,
  branchName,
  couponTypeLabel,
  couponCategoryLabel,
  couponValueText,
  couponExpiryText,
  couponSourceLabel,
  toDateInput,
  formatDay,
  formatDate,
  enabledText,
  vipName,
  isLineLinked,
  lineStatusHtml,
};
})();
