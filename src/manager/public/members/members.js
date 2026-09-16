(function () {
  const M = window.Manager;
  if (!M) return;

  const {
    api,
    escapeHtml,
    requireAuth,
    bindModalDismiss,
    vipName,
    lineStatusHtml,
  } = M;

  const importForm = document.getElementById("import-form");
  const importModal = document.getElementById("import-modal");
  const importError = document.getElementById("import-error");
  const importResult = document.getElementById("import-result");

  function renderMembers(users) {
    const rows = document.getElementById("member-rows");

    if (!users.length) {
      rows.innerHTML = `<tr><td colspan="6" class="empty">${
        document.getElementById("member-search").value.trim() ||
        document.getElementById("member-line-filter").value
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
        return `<tr class="clickable" data-href="/members/${escapeHtml(user.id)}">
        <td>${avatar}</td>
        <td>${escapeHtml(user.mobile || "—")}</td>
        <td>${escapeHtml(user.displayName || "—")}</td>
        <td>${escapeHtml(user.birthday || "—")}</td>
        <td>${escapeHtml(vipName(user))}</td>
        <td>${lineStatusHtml(user)}</td>
      </tr>`;
      })
      .join("");
  }

  async function loadMembers() {
    const q = document.getElementById("member-search").value.trim();
    const line = document.getElementById("member-line-filter").value;
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (line) params.set("line", line);
    const query = params.toString();
    const data = await api(`/users${query ? `?${query}` : ""}`);
    renderMembers(data.users || []);
  }

  window.loadMembers = loadMembers;

  function fillImportBranchSelect(branches) {
    const select = importForm.branchId;
    select.innerHTML =
      '<option value="">請選擇分店</option>' +
      branches
        .map(
          (branch) =>
            `<option value="${escapeHtml(branch.id)}">${escapeHtml(branch.name)}</option>`
        )
        .join("");
  }

  function openImportModal() {
    importError.textContent = "";
    importResult.textContent = "";
    importForm.reset();
    importModal.classList.remove("hidden");

    api("/branches")
      .then((data) => {
        const branches = data.branches || [];
        fillImportBranchSelect(branches);
        if (!branches.length) {
          importError.textContent = "尚無分店，請先到分店頁新增";
        }
      })
      .catch((error) => {
        importError.textContent = error.message;
      });
  }

  window.openMemberImport = openImportModal;

  function closeImportModal() {
    importModal.classList.add("hidden");
  }

  document.getElementById("member-search-btn").addEventListener("click", () => {
    loadMembers();
  });

  document.getElementById("member-line-filter").addEventListener("change", () => {
    loadMembers();
  });

  document.getElementById("member-search").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loadMembers();
    }
  });

  let memberSearchTimer = null;
  document.getElementById("member-search").addEventListener("input", () => {
    clearTimeout(memberSearchTimer);
    memberSearchTimer = setTimeout(() => {
      loadMembers();
    }, 300);
  });

  document.getElementById("import-open-btn").addEventListener("click", () => {
    openImportModal();
  });

  document.getElementById("import-cancel-btn").addEventListener("click", () => {
    closeImportModal();
  });

  bindModalDismiss(importModal, closeImportModal);

  importForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    importError.textContent = "";
    importResult.textContent = "";

    const file = importForm.file.files[0];
    const branchId = importForm.branchId.value;
    if (!branchId) {
      importError.textContent = "請選擇分店";
      return;
    }
    if (!file) {
      importError.textContent = "請選擇檔案";
      return;
    }

    try {
      const csv = await file.text();
      const data = await api("/transactions/import", {
        method: "POST",
        toast: "匯入完成",
        body: JSON.stringify({ csv, branchId }),
      });
      importResult.textContent = `匯入完成：新增 ${data.imported} 筆，新建會員 ${data.createdUsers}，沒電話 ${data.skippedNoMobile}，重複 ${data.skippedDuplicate}`;
    } catch (error) {
      importError.textContent = error.message;
    }
  });

  document.getElementById("member-rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-href]");
    if (row?.dataset.href) location.href = row.dataset.href;
  });

  async function init() {
    const manager = await requireAuth();
    if (!manager) return;

    try {
      await loadMembers();
    } catch {
      /* page data failed independently of auth */
    }
  }

  init();
})();
