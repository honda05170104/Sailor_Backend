const {
  api,
  escapeHtml,
  requireAuth,
  bindModalDismiss,
  couponTypeLabel,
  couponCategoryLabel,
  couponValueText,
  couponExpiryText,
  toDateInput,
} = window.Manager;

const couponForm = document.getElementById("coupon-form");
const couponModal = document.getElementById("coupon-modal");
const couponError = document.getElementById("coupon-error");
const categoryFilter = document.getElementById("coupon-category-filter");
const fixedFields = document.getElementById("coupon-fixed-fields");
const relativeFields = document.getElementById("coupon-relative-fields");
let editingCouponId = null;
let cachedCoupons = [];

function renderCoupons(coupons) {
  const rows = document.getElementById("coupon-rows");

  if (!coupons.length) {
    rows.innerHTML = '<tr><td colspan="8" class="empty">尚無優惠券</td></tr>';
    return;
  }

  rows.innerHTML = coupons
    .map(
      (coupon) =>
        `<tr class="clickable" data-id="${escapeHtml(coupon.id)}">
          <td>${escapeHtml(coupon.name)}</td>
          <td>${escapeHtml(couponCategoryLabel(coupon.category))}</td>
          <td>${escapeHtml(couponTypeLabel(coupon.type))}</td>
          <td>${escapeHtml(couponValueText(coupon))}</td>
          <td>${escapeHtml(coupon.minSpend ?? 0)}</td>
          <td>${escapeHtml(couponExpiryText(coupon))}</td>
          <td>${coupon.enabled === false ? "停用" : "啟用"}</td>
          <td>${escapeHtml(coupon.description || "—")}</td>
        </tr>`
    )
    .join("");
}

async function loadCoupons() {
  const category = categoryFilter.value;
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const data = await api(`/coupons${query}`);
  cachedCoupons = data.coupons || [];
  renderCoupons(cachedCoupons);
  return cachedCoupons;
}

function syncCouponValueLimit() {
  const valueInput = couponForm.value;
  if (couponForm.type.value === "percent") {
    valueInput.max = "100";
  } else {
    valueInput.removeAttribute("max");
  }
}

function syncExpiryModeFields() {
  const mode = couponForm.expiryMode.value;
  const isRelative = mode === "relative";
  fixedFields.classList.toggle("hidden", isRelative);
  relativeFields.classList.toggle("hidden", !isRelative);
  couponForm.startsAt.required = !isRelative;
  couponForm.endsAt.required = !isRelative;
  couponForm.expireDays.required = isRelative;
}

function openCouponModal(coupon) {
  couponError.textContent = "";
  if (coupon) {
    editingCouponId = coupon.id;
    couponForm.name.value = coupon.name || "";
    couponForm.category.value = coupon.category || "general";
    couponForm.type.value = coupon.type || "amount";
    couponForm.value.value = coupon.value ?? 0;
    couponForm.minSpend.value = coupon.minSpend ?? 0;
    couponForm.expiryMode.value = coupon.expiryMode || "fixed";
    couponForm.startsAt.value = toDateInput(coupon.startsAt);
    couponForm.endsAt.value = toDateInput(coupon.endsAt);
    couponForm.expireDays.value = coupon.expireDays ?? 30;
    couponForm.description.value = coupon.description || "";
    couponForm.enabled.checked = coupon.enabled !== false;
    document.getElementById("coupon-modal-title").textContent = "編輯優惠券";
    document.getElementById("coupon-submit-btn").textContent = "儲存";
  } else {
    editingCouponId = null;
    couponForm.reset();
    couponForm.category.value = "general";
    couponForm.minSpend.value = "0";
    couponForm.expiryMode.value = "fixed";
    couponForm.expireDays.value = "30";
    couponForm.enabled.checked = true;
    document.getElementById("coupon-modal-title").textContent = "新增優惠券";
    document.getElementById("coupon-submit-btn").textContent = "新增";
  }
  syncCouponValueLimit();
  syncExpiryModeFields();
  couponModal.classList.remove("hidden");
}

function closeCouponModal() {
  couponModal.classList.add("hidden");
  editingCouponId = null;
}

document.getElementById("coupon-type").addEventListener("change", () => {
  syncCouponValueLimit();
});

document.getElementById("coupon-expiry-mode").addEventListener("change", () => {
  syncExpiryModeFields();
});

categoryFilter.addEventListener("change", () => {
  loadCoupons().catch(() => {});
});

couponForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  couponError.textContent = "";

  try {
    const mode = couponForm.expiryMode.value;
    const payload = {
      name: couponForm.name.value,
      category: couponForm.category.value,
      type: couponForm.type.value,
      value: couponForm.value.value,
      minSpend: couponForm.minSpend.value,
      expiryMode: mode,
      description: couponForm.description.value,
      enabled: couponForm.enabled.checked,
    };
    if (mode === "relative") {
      payload.expireDays = couponForm.expireDays.value;
      payload.startsAt = "";
      payload.endsAt = "";
    } else {
      payload.startsAt = couponForm.startsAt.value;
      payload.endsAt = couponForm.endsAt.value;
      payload.expireDays = "";
    }
    if (editingCouponId) {
      await api(`/coupons/${editingCouponId}`, {
        method: "POST",
        toast: "優惠券已更新",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/coupons", {
        method: "POST",
        toast: "優惠券已新增",
        body: JSON.stringify(payload),
      });
    }
    closeCouponModal();
    await loadCoupons();
  } catch (error) {
    couponError.textContent = error.message;
  }
});

document.getElementById("coupon-open-btn").addEventListener("click", () => {
  openCouponModal();
});

document.getElementById("coupon-rows").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row?.dataset.id) return;
  const coupon = cachedCoupons.find((item) => String(item.id) === String(row.dataset.id));
  if (coupon) openCouponModal(coupon);
});

document.getElementById("coupon-cancel-btn").addEventListener("click", () => {
  closeCouponModal();
});

bindModalDismiss(couponModal, closeCouponModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadCoupons();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
