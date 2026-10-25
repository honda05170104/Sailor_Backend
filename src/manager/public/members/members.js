(function () {
  const M = window.Manager;
  if (!M) return;

  const {
    api,
    escapeHtml,
    requireAuth,
    vipName,
    lineStatusHtml,
    formatDate,
    formatVipExpiry,
    registeredStoreLabel,
  } = M;

  let cachedUsers = [];
  let memberPage = 1;

  function renderPager(data) {
    const pager = document.getElementById("member-pager");
    const total = Number(data.total) || 0;
    const page = Number(data.page) || 1;
    const pageCount = Number(data.pageCount) || 1;

    if (!total) {
      pager.classList.add("hidden");
      return;
    }

    pager.classList.remove("hidden");
    document.getElementById("member-page-label").textContent =
      `第 ${page} / ${pageCount} 頁，共 ${total} 筆`;
    document.getElementById("member-prev").disabled = page <= 1;
    document.getElementById("member-next").disabled = page >= pageCount;
  }

  function renderMembers(users) {
    const rows = document.getElementById("member-rows");
    cachedUsers = users;

    if (!users.length) {
      rows.innerHTML = `<tr><td colspan="9" class="empty">${
        document.getElementById("member-search").value.trim() ||
        document.getElementById("member-line-filter").value ||
        document.getElementById("member-vip-filter").value
          ? "找不到符合的會員"
          : "尚無會員資料"
      }</td></tr>`;
      return;
    }

    rows.innerHTML = users
      .map((user) => {
        const avatar = user.avatarUrl
          ? `<img class="avatar" src="${escapeHtml(user.avatarUrl)}" alt="" />`
          : `<span class="avatar"></span>`;
        return `<tr class="clickable" data-href="/manager/members/${escapeHtml(user.id)}">
        <td>${avatar}</td>
        <td>${escapeHtml(user.mobile || "—")}</td>
        <td>${escapeHtml(user.displayName || "—")}</td>
        <td>${escapeHtml(registeredStoreLabel(user))}</td>
        <td>${escapeHtml(vipName(user))}</td>
        <td>${escapeHtml(formatVipExpiry(user))}</td>
        <td>${escapeHtml(user.totalSpend ?? 0)}</td>
        <td>${lineStatusHtml(user)}</td>
        <td>${escapeHtml(formatDate(user.lastUsedAt))}</td>
      </tr>`;
      })
      .join("");
  }

  async function loadMembers(page = memberPage) {
    memberPage = page;
    const q = document.getElementById("member-search").value.trim();
    const line = document.getElementById("member-line-filter").value;
    const vip = document.getElementById("member-vip-filter").value;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (line) params.set("line", line);
    if (vip) params.set("vip", vip);
    if (memberPage > 1) params.set("page", String(memberPage));
    const query = params.toString();
    const data = await api(`/users${query ? `?${query}` : ""}`);
    memberPage = data.page || 1;
    renderMembers(data.users || []);
    renderPager(data);
  }

  function searchMembers() {
    return loadMembers(1);
  }

  window.loadMembers = searchMembers;

  function fillVipOptions(vips) {
    const select = document.getElementById("member-vip-filter");
    const current = select.value;
    select.innerHTML =
      '<option value="">全部等級</option>' +
      vips
        .map(
          (vip) =>
            `<option value="${escapeHtml(vip.slug)}">${escapeHtml(vip.name)}</option>`
        )
        .join("");
    if (current) select.value = current;
  }

  document.getElementById("member-search-btn").addEventListener("click", () => {
    searchMembers();
  });

  document.getElementById("member-line-filter").addEventListener("change", () => {
    searchMembers();
  });

  document.getElementById("member-vip-filter").addEventListener("change", () => {
    searchMembers();
  });

  document.getElementById("member-prev").addEventListener("click", () => {
    if (memberPage > 1) loadMembers(memberPage - 1);
  });

  document.getElementById("member-next").addEventListener("click", () => {
    loadMembers(memberPage + 1);
  });

  document.getElementById("message-open-btn").addEventListener("click", () => {
    location.href = "/manager/messages";
  });

  document.getElementById("member-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchMembers();
    }
  });

  let memberSearchTimer = null;
  document.getElementById("member-search").addEventListener("input", () => {
    clearTimeout(memberSearchTimer);
    memberSearchTimer = setTimeout(() => {
      searchMembers();
    }, 300);
  });

  document.getElementById("member-rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-href]");
    if (row?.dataset.href) location.href = row.dataset.href;
  });

  async function init() {
    const manager = await requireAuth();
    if (!manager) return;

    try {
      const vipData = await api("/vips");
      fillVipOptions(vipData.vips || []);
      await loadMembers();
    } catch {
      /* page data failed independently of auth */
    }
  }

  init();
})();
