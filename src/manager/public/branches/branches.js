const { api, escapeHtml, requireAuth } = window.Manager;

function renderBranches(branches) {
  const rows = document.getElementById("branch-rows");

  if (!branches.length) {
    rows.innerHTML = '<tr><td colspan="5" class="empty">尚無分店</td></tr>';
    return;
  }

  rows.innerHTML = branches
    .map((branch) => {
      const line = branch.lineUrl
        ? `<a href="${escapeHtml(branch.lineUrl)}" target="_blank" rel="noopener noreferrer">開啟</a>`
        : "—";
      const hours = branch.hours
        ? `${escapeHtml(branch.hoursLabel || "營業時間")}：${escapeHtml(branch.hours)}`
        : "—";
      return `<tr>
          <td>${escapeHtml(branch.name)}</td>
          <td>${escapeHtml(branch.address || "—")}</td>
          <td>${escapeHtml(branch.phone || "—")}</td>
          <td>${line}</td>
          <td>${hours}</td>
        </tr>`;
    })
    .join("");
}

async function loadBranches() {
  const data = await api("/branches");
  renderBranches(data.branches || []);
}

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadBranches();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
