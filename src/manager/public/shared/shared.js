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
  if (fetchOptions.body) headers["Content-Type"] = "application/json";

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

const COUPON_STATUS_LABELS = {
  available: "未使用",
  used: "已使用",
  expired: "已過期",
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

return {
  TOKEN_KEY,
  LOGIN_PATH,
  HOME_PATH,
  BRANCH_TYPE_LABELS,
  COUPON_TYPE_LABELS,
  COUPON_STATUS_LABELS,
  getToken,
  setToken,
  clearToken,
  showToast,
  api,
  escapeHtml,
  fillWho,
  bindLogout,
  bindModalDismiss,
  requireAuth,
  branchTypeLabel,
  branchName,
  couponTypeLabel,
  couponValueText,
  toDateInput,
  formatDay,
  formatDate,
  enabledText,
  vipName,
  isLineLinked,
  lineStatusHtml,
};
})();
