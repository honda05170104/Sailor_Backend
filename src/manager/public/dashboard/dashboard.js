const { requireAuth, api, showToast } = window.Manager;

async function loadDashboard() {
  const value = document.getElementById("new-members-today");

  try {
    const data = await api("/dashboard");
    value.textContent = String(data.newMembersToday ?? 0);
  } catch (error) {
    value.textContent = "—";
    showToast(error.message || "讀取失敗", "error");
  }
}

requireAuth().then((manager) => {
  if (!manager) return;
  loadDashboard();
});
