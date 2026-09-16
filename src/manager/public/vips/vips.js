const { api, escapeHtml, requireAuth, bindModalDismiss } = window.Manager;

const vipForm = document.getElementById("vip-form");
const vipModal = document.getElementById("vip-modal");
const vipError = document.getElementById("vip-error");
let editingVipId = null;
let cachedVips = [];

function renderVips(vips) {
  const rows = document.getElementById("vip-rows");

  if (!vips.length) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">尚無會員等級</td></tr>';
    return;
  }

  rows.innerHTML = vips
    .map(
      (vip) =>
        `<tr class="clickable" data-id="${escapeHtml(vip.id)}">
          <td>${escapeHtml(vip.name)}</td>
          <td>${escapeHtml(vip.slug)}</td>
          <td>${escapeHtml(vip.rank)}</td>
          <td>${escapeHtml(vip.minSpend ?? 0)}</td>
        </tr>`
    )
    .join("");
}

async function loadVips() {
  const data = await api("/vips");
  cachedVips = data.vips || [];
  renderVips(cachedVips);
  return cachedVips;
}

function openVipModal(vip) {
  vipError.textContent = "";
  if (vip) {
    editingVipId = vip.id;
    vipForm.name.value = vip.name || "";
    vipForm.slug.value = vip.slug || "";
    vipForm.rank.value = vip.rank ?? "";
    vipForm.minSpend.value = vip.minSpend ?? 0;
    document.getElementById("vip-modal-title").textContent = "編輯會員等級";
    document.getElementById("vip-submit-btn").textContent = "儲存";
  } else {
    editingVipId = null;
    vipForm.reset();
    vipForm.minSpend.value = "0";
    document.getElementById("vip-modal-title").textContent = "新增會員等級";
    document.getElementById("vip-submit-btn").textContent = "新增";
  }
  vipModal.classList.remove("hidden");
}

function closeVipModal() {
  vipModal.classList.add("hidden");
  editingVipId = null;
}

vipForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    vipError.textContent = "";

    try {
      const payload = {
        name: vipForm.name.value,
        slug: vipForm.slug.value,
        rank: vipForm.rank.value,
        minSpend: vipForm.minSpend.value,
      };
      if (editingVipId) {
        await api(`/vips/${editingVipId}`, {
          method: "POST",
          toast: "VIP 已更新",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/vips", {
          method: "POST",
          toast: "VIP 已新增",
          body: JSON.stringify(payload),
        });
      }
      closeVipModal();
      await loadVips();
    } catch (error) {
      vipError.textContent = error.message;
    }
  });

  document.getElementById("vip-open-btn").addEventListener("click", () => {
    openVipModal();
  });

  document.getElementById("vip-rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row?.dataset.id) return;
    const vip = cachedVips.find((item) => String(item.id) === String(row.dataset.id));
    if (vip) openVipModal(vip);
  });

  document.getElementById("vip-cancel-btn").addEventListener("click", () => {
    closeVipModal();
  });

bindModalDismiss(vipModal, closeVipModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadVips();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
