const {
  api,
  escapeHtml,
  requireAuth,
  bindModalDismiss,
  couponTypeLabel,
  couponValueText,
  toDateInput,
} = window.Manager;

const couponForm = document.getElementById("coupon-form");
const couponModal = document.getElementById("coupon-modal");
const couponError = document.getElementById("coupon-error");
let editingCouponId = null;
let cachedCoupons = [];

function renderCoupons(coupons) {
  const rows = document.getElementById("coupon-rows");

  if (!coupons.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">尚無優惠券</td></tr>';
    return;
  }

  rows.innerHTML = coupons
    .map(
      (coupon) =>
        `<tr class="clickable" data-id="${escapeHtml(coupon.id)}">
          <td>${escapeHtml(coupon.name)}</td>
          <td>${escapeHtml(couponTypeLabel(coupon.type))}</td>
          <td>${escapeHtml(couponValueText(coupon))}</td>
          <td>${escapeHtml(coupon.minSpend ?? 0)}</td>
          <td>${coupon.enabled === false ? "停用" : "啟用"}</td>
          <td>${escapeHtml(coupon.description || "—")}</td>
        </tr>`
    )
    .join("");
}

async function loadCoupons() {
  const data = await api("/coupons");
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

function openCouponModal(coupon) {
  couponError.textContent = "";
  if (coupon) {
    editingCouponId = coupon.id;
    couponForm.name.value = coupon.name || "";
    couponForm.type.value = coupon.type || "amount";
    couponForm.value.value = coupon.value ?? 0;
    couponForm.minSpend.value = coupon.minSpend ?? 0;
    couponForm.startsAt.value = toDateInput(coupon.startsAt);
    couponForm.endsAt.value = toDateInput(coupon.endsAt);
    couponForm.description.value = coupon.description || "";
    couponForm.enabled.checked = coupon.enabled !== false;
    document.getElementById("coupon-modal-title").textContent = "編輯優惠券";
    document.getElementById("coupon-submit-btn").textContent = "儲存";
  } else {
    editingCouponId = null;
    couponForm.reset();
    couponForm.minSpend.value = "0";
    couponForm.enabled.checked = true;
    document.getElementById("coupon-modal-title").textContent = "新增優惠券";
    document.getElementById("coupon-submit-btn").textContent = "新增";
  }
  syncCouponValueLimit();
  couponModal.classList.remove("hidden");
}

function closeCouponModal() {
  couponModal.classList.add("hidden");
  editingCouponId = null;
}

document.getElementById("coupon-type").addEventListener("change", () => {
  syncCouponValueLimit();
});

couponForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  couponError.textContent = "";

  try {
    const payload = {
      name: couponForm.name.value,
      type: couponForm.type.value,
      value: couponForm.value.value,
      minSpend: couponForm.minSpend.value,
      startsAt: couponForm.startsAt.value,
      endsAt: couponForm.endsAt.value,
      description: couponForm.description.value,
      enabled: couponForm.enabled.checked,
    };
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
