const { api, escapeHtml, requireAuth, formatDate } = window.Manager;

const branchSelect = document.getElementById("import-branch");
const dateInput = document.getElementById("import-date");
const summary = document.getElementById("import-summary");
const rows = document.getElementById("import-rows");

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

function renderOrders(orders) {
  if (!orders.length) {
    rows.innerHTML = '<tr><td colspan="7" class="empty">這天沒有匯入紀錄</td></tr>';
    summary.textContent = "這天沒有匯入紀錄";
    return;
  }

  summary.textContent = `共 ${orders.length} 筆`;
  rows.innerHTML = orders
    .map(
      (order) => `<tr>
        <td>${escapeHtml(storeLabel(order.branch))}</td>
        <td>${escapeHtml(order.externalOrderId || "—")}</td>
        <td>${escapeHtml(order.customerName || "—")}</td>
        <td>${escapeHtml(order.customerMobile || "—")}</td>
        <td>${itemsHtml(order.items || [])}</td>
        <td>${escapeHtml(order.totalAmount ?? 0)}</td>
        <td>${escapeHtml(formatDate(order.createdAt))}</td>
      </tr>`
    )
    .join("");
}

async function loadOrders() {
  const params = new URLSearchParams();
  if (branchSelect.value) params.set("branchId", branchSelect.value);
  if (dateInput.value) params.set("date", dateInput.value);
  const query = params.toString();
  const data = await api(`/imported-orders${query ? `?${query}` : ""}`);
  renderOrders(data.importedOrders || []);
}

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  dateInput.value = todayTaipei();

  try {
    const data = await api("/branches");
    fillBranchSelect(data.branches || []);
    await loadOrders();
  } catch (error) {
    rows.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(error.message)}</td></tr>`;
    summary.textContent = error.message;
  }

  document.getElementById("import-search-btn").addEventListener("click", () => {
    loadOrders().catch((error) => {
      rows.innerHTML = `<tr><td colspan="7" class="empty">${escapeHtml(error.message)}</td></tr>`;
      summary.textContent = error.message;
    });
  });

  dateInput.addEventListener("change", () => {
    loadOrders().catch(() => {});
  });
  branchSelect.addEventListener("change", () => {
    loadOrders().catch(() => {});
  });
}

init();
