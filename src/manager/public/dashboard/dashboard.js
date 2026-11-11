const { requireAuth, api, showToast, escapeHtml } = window.Manager;

const fromInput = document.getElementById("dashboard-from");
const toInput = document.getElementById("dashboard-to");
const grid = document.getElementById("store-grid");
let report = null;

function todayTaipei() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function monthStart(date) {
  return `${date.slice(0, 7)}-01`;
}

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

function cardHtml(card, { total = false } = {}) {
  const tiers = (card.tiers || [])
    .map(
      (tier) => `<li>
        <span>${escapeHtml(tier.name || "會員")}</span>
        <span>${escapeHtml(formatCount(tier.count))}</span>
      </li>`
    )
    .join("");
  const notes = [];
  if (total && Number(card.unassignedMembers)) {
    notes.push(`含未指定分店 ${formatCount(card.unassignedMembers)} 人`);
  }
  if (total && Number(card.unassignedNewMembers)) {
    notes.push(`未指定分店新增 ${formatCount(card.unassignedNewMembers)} 人`);
  }
  const noteHtml = notes.length
    ? `<p class="store-note">${escapeHtml(notes.join("，"))}</p>`
    : "";

  return `<article class="store-card${total ? " is-total" : ""}">
    <h3>${escapeHtml(card.name || "分店")}</h3>
    <p class="label">累積營業額</p>
    <p class="revenue">${escapeHtml(formatMoney(card.revenue))}</p>
    <ul class="tier-list">
      ${tiers}
      <li class="tier-total">
        <span>合計</span>
        <span>${escapeHtml(formatCount(card.memberTotal))}</span>
      </li>
      <li class="tier-new">
        <span>新增人數</span>
        <span>${escapeHtml(formatCount(card.newMembers))}</span>
      </li>
    </ul>
    ${noteHtml}
  </article>`;
}

function renderDashboard(data) {
  report = data;
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

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function exportReport() {
  if (!report) {
    showToast("請先載入總覽", "error");
    return;
  }
  const tiers = report.total?.tiers || report.stores?.[0]?.tiers || [];
  const headers = ["分店", "累積營業額", ...tiers.map((tier) => tier.name || "會員"), "合計", "新增人數"];
  const rows = [report.total, ...(report.stores || [])].filter(Boolean).map((card) => [
    card.name,
    Math.round(Number(card.revenue) || 0),
    ...(card.tiers || []).map((tier) => Number(tier.count) || 0),
    Number(card.memberTotal) || 0,
    Number(card.newMembers) || 0,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `總覽-${report.from || ""}-${report.to || ""}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function loadDashboard() {
  const from = fromInput.value;
  const to = toInput.value;
  if (!from || !to) return;
  if (from > to) {
    showToast("開始日期不能晚於結束日期", "error");
    return;
  }
  const params = new URLSearchParams({ from, to });
  try {
    const data = await api(`/dashboard?${params}`);
    renderDashboard(data);
  } catch (error) {
    grid.innerHTML = `<p class="hint">${escapeHtml(error.message || "讀取失敗")}</p>`;
    showToast(error.message || "讀取失敗", "error");
  }
}

requireAuth().then((manager) => {
  if (!manager) return;
  const today = todayTaipei();
  fromInput.value = monthStart(today);
  toInput.value = today;
  fromInput.addEventListener("change", () => {
    loadDashboard();
  });
  toInput.addEventListener("change", () => {
    loadDashboard();
  });
  document.getElementById("dashboard-export").addEventListener("click", () => {
    exportReport();
  });
  loadDashboard();
});
