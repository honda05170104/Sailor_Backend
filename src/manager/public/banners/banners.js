const { api, escapeHtml, requireAuth, bindModalDismiss } = window.Manager;

const bannerForm = document.getElementById("banner-form");
const bannerModal = document.getElementById("banner-modal");
const bannerError = document.getElementById("banner-error");
const bannerDeleteBtn = document.getElementById("banner-delete-btn");
const bannerImageInput = document.getElementById("banner-image");
const bannerPreviewWrap = document.getElementById("banner-preview-wrap");
const bannerPreview = document.getElementById("banner-preview");
let editingBannerId = null;
let cachedBanners = [];

function renderBanners(banners) {
  const rows = document.getElementById("banner-rows");

  if (!banners.length) {
    rows.innerHTML = '<tr><td colspan="4" class="empty">尚無 Banner</td></tr>';
    return;
  }

  rows.innerHTML = banners
    .map(
      (banner) => `<tr class="clickable" data-id="${escapeHtml(banner.id)}">
        <td><img class="banner-thumb" src="${escapeHtml(banner.imageUrl)}" alt="" /></td>
        <td>${escapeHtml(banner.linkUrl || "—")}</td>
        <td>${escapeHtml(banner.sortOrder ?? 0)}</td>
        <td>${banner.enabled === false ? "停用" : "啟用"}</td>
      </tr>`
    )
    .join("");
}

async function loadBanners() {
  const data = await api("/banners");
  cachedBanners = data.banners || [];
  renderBanners(cachedBanners);
  return cachedBanners;
}

function setPreview(url) {
  if (!url) {
    bannerPreviewWrap.classList.add("hidden");
    bannerPreview.removeAttribute("src");
    return;
  }
  bannerPreview.src = url;
  bannerPreviewWrap.classList.remove("hidden");
}

function openBannerModal(banner) {
  bannerError.textContent = "";
  bannerImageInput.value = "";

  if (banner) {
    editingBannerId = banner.id;
    bannerForm.linkUrl.value = banner.linkUrl || "";
    bannerForm.sortOrder.value = banner.sortOrder ?? 0;
    bannerForm.enabled.checked = banner.enabled !== false;
    document.getElementById("banner-modal-title").textContent = "編輯 Banner";
    document.getElementById("banner-submit-btn").textContent = "儲存";
    bannerDeleteBtn.classList.remove("hidden");
    setPreview(banner.imageUrl);
  } else {
    editingBannerId = null;
    bannerForm.reset();
    bannerForm.sortOrder.value = "0";
    bannerForm.enabled.checked = true;
    document.getElementById("banner-modal-title").textContent = "新增 Banner";
    document.getElementById("banner-submit-btn").textContent = "新增";
    bannerDeleteBtn.classList.add("hidden");
    setPreview("");
  }

  bannerModal.classList.remove("hidden");
}

function closeBannerModal() {
  bannerModal.classList.add("hidden");
  editingBannerId = null;
}

bannerImageInput.addEventListener("change", () => {
  const file = bannerImageInput.files[0];
  if (!file) return;
  setPreview(URL.createObjectURL(file));
});

document.getElementById("banner-open-btn").addEventListener("click", () => {
  openBannerModal();
});

document.getElementById("banner-cancel-btn").addEventListener("click", () => {
  closeBannerModal();
});

document.getElementById("banner-rows").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  const banner = cachedBanners.find((item) => String(item.id) === row.dataset.id);
  if (banner) openBannerModal(banner);
});

bannerDeleteBtn.addEventListener("click", async () => {
  if (!editingBannerId) return;
  if (!confirm("確定刪除這個 Banner？")) return;
  bannerError.textContent = "";
  try {
    await api(`/banners/${editingBannerId}/delete`, {
      method: "POST",
      toast: "Banner 已刪除",
    });
    closeBannerModal();
    await loadBanners();
  } catch (error) {
    bannerError.textContent = error.message;
  }
});

bannerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bannerError.textContent = "";

  const file = bannerImageInput.files[0];
  if (!editingBannerId && !file) {
    bannerError.textContent = "請選擇圖片";
    return;
  }

  const body = new FormData();
  body.append("linkUrl", bannerForm.linkUrl.value);
  body.append("sortOrder", bannerForm.sortOrder.value);
  body.append("enabled", bannerForm.enabled.checked ? "true" : "false");
  if (file) body.append("image", file);

  const submitBtn = document.getElementById("banner-submit-btn");
  submitBtn.disabled = true;

  try {
    if (editingBannerId) {
      await api(`/banners/${editingBannerId}`, {
        method: "POST",
        toast: "Banner 已更新",
        body,
      });
    } else {
      await api("/banners", {
        method: "POST",
        toast: "Banner 已新增",
        body,
      });
    }
    closeBannerModal();
    await loadBanners();
  } catch (error) {
    bannerError.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
  }
});

bindModalDismiss(bannerModal, closeBannerModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadBanners();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
