const { requireAuth, api, showToast, escapeHtml } = window.Manager;

function formatMoney(value) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function formatMonth(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!match) return "";
  return `${match[1]}年${Number(match[2])}月`;
}

function cardHtml(card, { total = false } = {}) {
  const tiers = (card.tiers || [])
    .map(
      (tier) => `<li>
        <span>${escapeHtml(tier.name || "會員")}</span>
        <span>${escapeHtml(formatCount(tier.count))}</span>
      </li>`
    )
    .join("");
  const unassigned = Number(card.unassignedMembers) || 0;
  const unassignedHtml =
    total && unassigned
      ? `<p class="store-note">含未指定分店 ${escapeHtml(formatCount(unassigned))} 人</p>`
      : "";

  return `<article class="store-card${total ? " is-total" : ""}">
    <h3>${escapeHtml(card.name || "分店")}</h3>
    <p class="label">當月累積營業額</p>
    <p class="revenue">${escapeHtml(formatMoney(card.revenue))}</p>
    <ul class="tier-list">
      ${tiers}
      <li class="tier-total">
        <span>合計</span>
        <span>${escapeHtml(formatCount(card.memberTotal))}</span>
      </li>
    </ul>
    ${unassignedHtml}
  </article>`;
}

function renderDashboard(data) {
  const month = document.getElementById("dashboard-month");
  const grid = document.getElementById("store-grid");
  month.textContent = formatMonth(data.month);
  const stores = data.stores || [];
  if (!data.total && !stores.length) {
    grid.innerHTML = '<p class="hint">沒有分店資料</p>';
    return;
  }
  grid.innerHTML = [
    data.total ? cardHtml(data.total, { total: true }) : "",
    ...stores.map((store) => cardHtml(store)),
  ].join("");
}

async function loadDashboard() {
  const grid = document.getElementById("store-grid");
  try {
    const data = await api("/dashboard");
    renderDashboard(data);
  } catch (error) {
    grid.innerHTML = `<p class="hint">${escapeHtml(error.message || "讀取失敗")}</p>`;
    showToast(error.message || "讀取失敗", "error");
  }
}

requireAuth().then((manager) => {
  if (!manager) return;
  loadDashboard();
});
