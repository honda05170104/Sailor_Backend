const { requireAuth, api, showToast } = window.Manager;

function renderVipCounts(membersByVip) {
  const grid = document.getElementById("stat-grid");
  const today = document.getElementById("new-members-today").closest("article");
  grid.querySelectorAll("[data-vip]").forEach((card) => card.remove());

  for (const item of membersByVip || []) {
    const card = document.createElement("article");
    card.className = "stat-card";
    card.dataset.vip = item.slug || item.id || "";

    const label = document.createElement("p");
    label.className = "label";
    label.textContent = item.name || "會員";

    const value = document.createElement("p");
    value.className = "value";
    value.textContent = Number(item.count || 0).toLocaleString("zh-TW");

    card.append(label, value);
    grid.insertBefore(card, today);
  }
}

async function loadDashboard() {
  const value = document.getElementById("new-members-today");

  try {
    const data = await api("/dashboard");
    value.textContent = String(data.newMembersToday ?? 0);
    renderVipCounts(data.membersByVip);
  } catch (error) {
    value.textContent = "—";
    showToast(error.message || "讀取失敗", "error");
  }
}

requireAuth().then((manager) => {
  if (!manager) return;
  loadDashboard();
});
