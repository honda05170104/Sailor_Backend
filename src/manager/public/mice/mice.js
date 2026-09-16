(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, escapeHtml, requireAuth, showToast } = M;

  const FORM_LABELS = { live: "活體", frozen: "冷凍" };
  const SIZE_LABELS = { small: "小白", large: "大白" };
  const SPEC_LABELS = {
    aged: "日齡",
    hairless: "無毛",
    fuzzy: "微毛",
    hopper: "跳跳",
    eyed: "開眼",
    smallLarge: "小大",
    mediumLarge: "中大",
    smallSubadult: "小亞成",
    subadult: "亞成",
    adult: "成體",
    extraAdult: "超成體",
  };

  const rangeEl = document.getElementById("mice-range");
  let cached = null;

  function formatMd(ymd) {
    const [year, month, day] = String(ymd || "").split("-").map(Number);
    if (!year || !month || !day) return "";
    return { year, text: `${month}月${day}日` };
  }

  function formatRange(start, end) {
    const from = formatMd(start);
    const to = formatMd(end);
    if (!from.text || !to.text) return "";
    if (from.year !== to.year) return `${from.year}年${from.text} 到 ${to.year}年${to.text}`;
    return `${from.text} 到 ${to.text}`;
  }

  function specLabel(item) {
    const spec = SPEC_LABELS[item.spec] || item.spec;
    if (item.spec === "aged" && item.ageDays) return `${spec} ${item.ageDays} 日`;
    return spec;
  }

  function renderOrders() {
    const root = document.getElementById("mice-orders");
    const orders = cached.orders || [];
    if (!orders.length) {
      root.innerHTML = '<p class="empty">這檔收單尚無訂單</p>';
      return;
    }

    root.innerHTML = orders
      .map((order) => {
        const name = order.user?.displayName || "未填名稱";
        const mobile = order.user?.mobile || "未填手機";
        const rows = (order.items || [])
          .map(
            (item) => `<tr>
              <td>${escapeHtml(FORM_LABELS[item.form] || item.form)}</td>
              <td>${escapeHtml(SIZE_LABELS[item.size] || item.size)}</td>
              <td>${escapeHtml(specLabel(item))}</td>
              <td>${item.packs}</td>
            </tr>`
          )
          .join("");
        return `<div class="order-card">
          <h4>${escapeHtml(name)}</h4>
          <p class="muted">${escapeHtml(mobile)} · ${order.totalPacks} 包</p>
          <table>
            <thead>
              <tr>
                <th>型態</th>
                <th>體型</th>
                <th>規格</th>
                <th>包數</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      })
      .join("");
  }

  async function loadMouseDay(date) {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    cached = await api(`/mice/week${query}`);
    rangeEl.textContent = formatRange(cached.startsOn, cached.endsOn);
    renderOrders();
  }

  async function shiftMouseDay(delta) {
    if (!cached) return;
    await loadMouseDay(delta < 0 ? cached.prevDate : cached.nextDate);
  }

  window.loadMouseDay = (date) => loadMouseDay(date);
  window.shiftMouseDay = (delta) => shiftMouseDay(delta);

  requireAuth().then((manager) => {
    if (!manager) return;
    loadMouseDay("").catch((error) => {
      showToast(error.message || "讀取失敗", "error");
    });
  });
})();
