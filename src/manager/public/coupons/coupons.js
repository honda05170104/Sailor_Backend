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
  const list = document.getElementById("coupon-list");

  if (!coupons.length) {
    list.innerHTML = '<p class="empty">尚無優惠券</p>';
    return;
  }

  list.innerHTML = coupons
    .map((coupon) => {
      const enabled = coupon.enabled !== false;
      const minSpend = coupon.minSpend ?? 0;
      return `<article class="coupon-card${enabled ? "" : " is-off"}" data-id="${escapeHtml(coupon.id)}" tabindex="0">
          <div class="coupon-card-top">
            <span class="coupon-category">${escapeHtml(couponCategoryLabel(coupon.category))}</span>
            <span class="coupon-status${enabled ? " is-on" : ""}">${enabled ? "啟用" : "停用"}</span>
          </div>
          <h3>${escapeHtml(coupon.name)}</h3>
          <p class="coupon-value">${escapeHtml(couponTypeLabel(coupon.type))} ${escapeHtml(couponValueText(coupon))}</p>
          <p class="coupon-meta">低消 ${escapeHtml(minSpend)} 元</p>
          <p class="coupon-expire">${escapeHtml(couponExpiryText(coupon))}</p>
          <p class="coupon-desc">${escapeHtml(coupon.description || "—")}</p>
        </article>`;
    })
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

document.getElementById("coupon-list").addEventListener("click", (event) => {
  const card = event.target.closest(".coupon-card[data-id]");
  if (!card?.dataset.id) return;
  const coupon = cachedCoupons.find((item) => String(item.id) === String(card.dataset.id));
  if (coupon) openCouponModal(coupon);
});

document.getElementById("coupon-list").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".coupon-card[data-id]");
  if (!card?.dataset.id) return;
  event.preventDefault();
  const coupon = cachedCoupons.find((item) => String(item.id) === String(card.dataset.id));
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
