const {
  api,
  escapeHtml,
  requireAuth,
  bindModalDismiss,
  couponTypeLabel,
  couponValueText,
  couponExpiryText,
} = window.Manager;

const promotionForm = document.getElementById("promotion-form");
const promotionModal = document.getElementById("promotion-modal");
const promotionError = document.getElementById("promotion-error");
let editingPromotionId = null;
let cachedPromotions = [];
let cachedCoupons = [];
let typeLabels = {
  join: "入會禮",
  upgrade: "升等禮",
  birthday: "生日禮",
};

function couponOptionLabel(coupon) {
  if (!coupon) return "—";
  return `${coupon.name}（${couponTypeLabel(coupon.type)} ${couponValueText(coupon)}｜${couponExpiryText(coupon)}）`;
}

function fillCouponOptions(selectedId) {
  const select = promotionForm.couponId;
  const options = cachedCoupons
    .filter((coupon) => coupon.enabled !== false || String(coupon.id) === String(selectedId || ""))
    .map(
      (coupon) =>
        `<option value="${escapeHtml(coupon.id)}">${escapeHtml(couponOptionLabel(coupon))}</option>`
    )
    .join("");
  select.innerHTML = `<option value="">請選擇</option>${options}`;
  if (selectedId) select.value = String(selectedId);
}

function renderPromotions(promotions) {
  const list = document.getElementById("promotion-list");

  if (!promotions.length) {
    list.innerHTML = '<p class="empty">尚無優惠活動</p>';
    return;
  }

  list.innerHTML = promotions
    .map((promo) => {
      const coupon =
        promo.coupon ||
        cachedCoupons.find((item) => String(item.id) === String(promo.couponId));
      const enabled = promo.enabled !== false;
      const value = coupon
        ? `${couponTypeLabel(coupon.type)} ${couponValueText(coupon)}`
        : "未綁定優惠券";
      return `<article class="promo-card${enabled ? "" : " is-off"}" data-id="${escapeHtml(promo.id)}" tabindex="0">
          <div class="promo-card-top">
            <span class="promo-type">${escapeHtml(typeLabels[promo.type] || promo.type)}</span>
            <span class="promo-status${enabled ? " is-on" : ""}">${enabled ? "啟用" : "停用"}</span>
          </div>
          <h3>${escapeHtml(promo.name)}</h3>
          <p class="promo-value">${escapeHtml(value)}</p>
          <p class="promo-coupon">${escapeHtml(coupon?.name || "尚未綁定優惠券")}</p>
          <p class="promo-expire">${escapeHtml(coupon ? couponExpiryText(coupon) : "—")}</p>
          <p class="promo-desc">${escapeHtml(promo.description || "尚無說明")}</p>
        </article>`;
    })
    .join("");
}

async function loadData() {
  const [promoData, couponData] = await Promise.all([
    api("/promotions"),
    api("/coupons"),
  ]);
  cachedPromotions = promoData.promotions || [];
  typeLabels = { ...typeLabels, ...(promoData.typeLabels || {}) };
  cachedCoupons = couponData.coupons || [];
  renderPromotions(cachedPromotions);
}

function openPromotionModal(promo) {
  promotionError.textContent = "";
  editingPromotionId = promo.id;
  promotionForm.name.value = promo.name || "";
  promotionForm.description.value = promo.description || "";
  promotionForm.enabled.checked = promo.enabled !== false;
  document.getElementById("promotion-type-hint").textContent =
    `類型：${typeLabels[promo.type] || promo.type}（固定，不可變更）`;
  fillCouponOptions(promo.couponId || promo.coupon?.id);
  promotionModal.classList.remove("hidden");
}

function closePromotionModal() {
  promotionModal.classList.add("hidden");
  editingPromotionId = null;
}

promotionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  promotionError.textContent = "";

  if (!editingPromotionId) return;

  try {
    await api(`/promotions/${editingPromotionId}`, {
      method: "POST",
      toast: "優惠活動已更新",
      body: JSON.stringify({
        name: promotionForm.name.value,
        description: promotionForm.description.value,
        enabled: promotionForm.enabled.checked,
        couponId: promotionForm.couponId.value,
      }),
    });
    closePromotionModal();
    await loadData();
  } catch (error) {
    promotionError.textContent = error.message;
  }
});

document.getElementById("promotion-list").addEventListener("click", (event) => {
  const card = event.target.closest(".promo-card[data-id]");
  if (!card?.dataset.id) return;
  const promo = cachedPromotions.find((item) => String(item.id) === String(card.dataset.id));
  if (promo) openPromotionModal(promo);
});

document.getElementById("promotion-list").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const card = event.target.closest(".promo-card[data-id]");
  if (!card?.dataset.id) return;
  event.preventDefault();
  const promo = cachedPromotions.find((item) => String(item.id) === String(card.dataset.id));
  if (promo) openPromotionModal(promo);
});

document.getElementById("promotion-cancel-btn").addEventListener("click", () => {
  closePromotionModal();
});

bindModalDismiss(promotionModal, closePromotionModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadData();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
