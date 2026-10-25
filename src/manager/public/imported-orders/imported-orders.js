const { api, escapeHtml, requireAuth, formatDate } = window.Manager;

const branchSelect = document.getElementById("import-branch");
const dateInput = document.getElementById("import-date");
const summary = document.getElementById("import-summary");
const rows = document.getElementById("import-rows");
const title = document.getElementById("import-title");
const backLink = document.getElementById("import-back");
const listToolbar = document.getElementById("import-list-toolbar");
const listPanel = document.getElementById("import-list-panel");
const detailPanel = document.getElementById("import-detail-panel");
const detailSummary = document.getElementById("import-detail-summary");
const detailRows = document.getElementById("import-detail-rows");

function todayTaipei() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function storeLabel(store) {
  const name = String(store?.name || "").trim();
  if (!name) return "—";
  const dash = name.lastIndexOf("-");
  return dash >= 0 ? name.slice(dash + 1) : name;
}

function itemSubtotal(item) {
  const subtotal = Number(item.subtotal) || 0;
  if (subtotal) return subtotal;
  return (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);
}

function itemsHtml(items) {
  if (!items.length) return "無品項";
  return `<ul class="import-items">${items
    .map((item) => {
      const name = item.name || "未命名";
      const subtotal = itemSubtotal(item);
      return `<li>
        <span>${escapeHtml(name)}</span>
        <span class="import-item-qty">${escapeHtml(item.unitPrice ?? 0)} × ${escapeHtml(item.quantity ?? 0)}</span>
        <span>${escapeHtml(subtotal)}</span>
      </li>`;
    })
    .join("")}</ul>`;
}

function fillBranchSelect(branches) {
  branchSelect.innerHTML =
    '<option value="">全部分店</option>' +
    branches
      .map(
        (branch) =>
          `<option value="${escapeHtml(branch.id)}">${escapeHtml(storeLabel(branch))}</option>`
      )
      .join("");
}

function selectedImportId() {
  return new URLSearchParams(location.search).get("id") || "";
}

function showList() {
  title.textContent = "匯入紀錄";
  backLink.classList.add("hidden");
  listToolbar.classList.remove("hidden");
  listPanel.classList.remove("hidden");
  detailPanel.classList.add("hidden");
}

function showDetail() {
  backLink.classList.remove("hidden");
  listToolbar.classList.add("hidden");
  listPanel.classList.add("hidden");
  detailPanel.classList.remove("hidden");
}

function renderBatches(batches) {
  showList();
  if (!batches.length) {
    rows.innerHTML = '<tr><td colspan="9" class="empty">這天沒有匯入紀錄</td></tr>';
    summary.textContent = "這天沒有匯入紀錄";
    return;
  }

  summary.textContent = `共 ${batches.length} 筆匯入`;
  rows.innerHTML = batches
    .map(
      (batch) => `<tr class="clickable" data-id="${escapeHtml(batch.id)}">
        <td>${escapeHtml(batch.orderDate || "—")}</td>
        <td>${escapeHtml(storeLabel(batch.branch))}</td>
        <td>${escapeHtml(batch.fileName || "—")}</td>
        <td>${escapeHtml(batch.totalOrders ?? 0)}</td>
        <td>${escapeHtml(batch.imported ?? 0)}</td>
        <td>${escapeHtml(batch.skippedNoMobile ?? 0)}</td>
        <td>${escapeHtml(batch.skippedDuplicate ?? 0)}</td>
        <td>${escapeHtml(batch.skippedVoided ?? 0)}</td>
        <td>${escapeHtml(formatDate(batch.importedAt || batch.createdAt))}</td>
      </tr>`
    )
    .join("");
}

function renderDetail(batch, orders) {
  showDetail();
  title.textContent = `${storeLabel(batch.branch)}｜${batch.orderDate || "—"}`;
  detailSummary.textContent = [
    batch.fileName || "無檔名",
    `總訂單 ${batch.totalOrders ?? 0}`,
    `成功轉交易 ${batch.imported ?? 0}`,
    `沒電話 ${batch.skippedNoMobile ?? 0}`,
    `重複 ${batch.skippedDuplicate ?? 0}`,
    `作廢 ${batch.skippedVoided ?? 0}`,
    `匯入 ${formatDate(batch.importedAt || batch.createdAt)}`,
  ].join("｜");

  if (!orders.length) {
    detailRows.innerHTML = '<tr><td colspan="5" class="empty">這批沒有訂單細項</td></tr>';
    return;
  }

  detailRows.innerHTML = orders
    .map(
      (order) => `<tr>
        <td>${escapeHtml(order.externalOrderId || "—")}</td>
        <td>${escapeHtml(order.customerName || "—")}</td>
        <td>${escapeHtml(order.customerMobile || "—")}</td>
        <td>${itemsHtml(order.items || [])}</td>
        <td>${escapeHtml(order.totalAmount ?? 0)}</td>
      </tr>`
    )
    .join("");
}

async function loadBatches() {
  const params = new URLSearchParams();
  if (branchSelect.value) params.set("branchId", branchSelect.value);
  if (dateInput.value) params.set("date", dateInput.value);
  const query = params.toString();
  const data = await api(`/imported-orders${query ? `?${query}` : ""}`);
  renderBatches(data.orderImports || []);
}

async function loadDetail(id) {
  const data = await api(`/imported-orders/${id}`);
  renderDetail(data.orderImport || {}, data.importedOrders || []);
}

function openDetail(id) {
  const url = new URL(location.href);
  url.searchParams.set("id", id);
  history.pushState({ id }, "", url);
  return loadDetail(id);
}

function closeDetail(push) {
  const url = new URL(location.href);
  url.searchParams.delete("id");
  if (push) history.pushState({}, "", url);
  return loadBatches();
}

async function loadPage() {
  const id = selectedImportId();
  if (id) {
    await loadDetail(id);
    return;
  }
  await loadBatches();
}

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  dateInput.value = todayTaipei();

  try {
    const data = await api("/branches");
    fillBranchSelect(data.branches || []);
    await loadPage();
  } catch (error) {
    rows.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(error.message)}</td></tr>`;
    summary.textContent = error.message;
  }

  document.getElementById("import-search-btn").addEventListener("click", () => {
    closeDetail(true).catch((error) => {
      rows.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(error.message)}</td></tr>`;
      summary.textContent = error.message;
    });
  });

  dateInput.addEventListener("change", () => {
    closeDetail(true).catch(() => {});
  });
  branchSelect.addEventListener("change", () => {
    closeDetail(true).catch(() => {});
  });

  rows.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row?.dataset.id) return;
    openDetail(row.dataset.id).catch((error) => {
      rows.innerHTML = `<tr><td colspan="9" class="empty">${escapeHtml(error.message)}</td></tr>`;
      summary.textContent = error.message;
    });
  });

  backLink.addEventListener("click", (event) => {
    event.preventDefault();
    closeDetail(true).catch(() => {});
  });

  window.addEventListener("popstate", () => {
    loadPage().catch(() => {});
  });
}

init();
