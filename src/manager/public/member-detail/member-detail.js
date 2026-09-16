const {
  api,
  escapeHtml,
  requireAuth,
  bindModalDismiss,
  vipName,
  lineStatusHtml,
  couponTypeLabel,
  couponValueText,
  formatDay,
  formatDate,
  branchName,
  COUPON_STATUS_LABELS,
} = window.Manager;

const memberCouponForm = document.getElementById("member-coupon-form");
const memberCouponModal = document.getElementById("member-coupon-modal");
const memberCouponModalError = document.getElementById("member-coupon-modal-error");
const memberEditForm = document.getElementById("member-edit-form");
const memberEditModal = document.getElementById("member-edit-modal");
const memberEditError = document.getElementById("member-edit-error");
const memberAnimalForm = document.getElementById("member-animal-form");
const memberAnimalModal = document.getElementById("member-animal-modal");
const memberAnimalError = document.getElementById("member-animal-error");
const memberTagCreate = document.getElementById("member-tag-create");
const memberTagCreateError = document.getElementById("member-tag-create-error");
let currentMember = null;

function memberIdFromPath() {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const match = path.match(/^\/members\/([^/]+)$/);
  return match ? match[1] : null;
}

function hideMemberTagCreate() {
  memberTagCreate.classList.add("hidden");
  memberTagCreateError.textContent = "";
  document.getElementById("member-tag-new-name").value = "";
  document.getElementById("member-tag-new-desc").value = "";
}

function selectedMemberTagIds() {
  return [...memberEditForm.querySelectorAll('input[name="tagIds"]:checked')].map(
    (input) => input.value
  );
}

function selectedMemberAnimalIds() {
  return [...memberAnimalForm.querySelectorAll('input[name="animalIds"]:checked')].map(
    (input) => input.value
  );
}

function renderMemberAnimalOptions(animalData, selected) {
  const options = document.getElementById("member-product-options");
  const selectedSet = new Set((selected || []).map(String));
  const enabled = (animalData?.animals || []).filter((item) => item.enabled !== false);
  const groups = new Map();

  for (const category of animalData?.categories || []) {
    if (category.enabled === false) continue;
    groups.set(String(category.id), { name: category.name, animals: [] });
  }

  const leftovers = [];
  for (const animal of enabled) {
    const key = String(animal.categoryId || animal.category?.id || "");
    if (groups.has(key)) groups.get(key).animals.push(animal);
    else leftovers.push(animal);
  }

  const list = [...groups.values()].filter((group) => group.animals.length);
  if (leftovers.length) list.push({ name: "未分類", animals: leftovers });

  if (!list.length) {
    options.innerHTML = '<p class="muted">尚無物種，請先到物種頁新增。</p>';
    return;
  }

  options.innerHTML = list
    .map((group) => {
      const rows = group.animals
        .map(
          (item) => `<label>
            <input type="checkbox" name="animalIds" value="${escapeHtml(item.id)}" ${
              selectedSet.has(String(item.id)) ? "checked" : ""
            } />
            ${escapeHtml(item.name)}
          </label>`
        )
        .join("");
      return `<div class="animal-group">
        <p class="animal-group-name">${escapeHtml(group.name)}</p>
        ${rows}
      </div>`;
    })
    .join("");
}

function renderMemberTagOptions(tags, selected) {
  const options = document.getElementById("member-tag-options");
  const selectedSet = new Set((selected || []).map(String));

  if (!tags.length) {
    options.innerHTML = '<p class="muted">尚無標籤，請先新增。</p>';
    return;
  }

  options.innerHTML = tags
    .map(
      (tag) =>
        `<label>
          <input type="checkbox" name="tagIds" value="${escapeHtml(tag.id)}" ${
            selectedSet.has(String(tag.id)) ? "checked" : ""
          } />
          ${escapeHtml(tag.name)}
        </label>`
    )
    .join("");
}

function fillVipSelect(vips, selectedId) {
  const select = memberEditForm.vipId;
  const current = selectedId ? String(selectedId) : "";
  select.innerHTML =
    '<option value="">請選擇等級</option>' +
    vips
      .map(
        (vip) =>
          `<option value="${escapeHtml(vip.id)}" ${
            String(vip.id) === current ? "selected" : ""
          }>${escapeHtml(vip.name)}</option>`
      )
      .join("");
}

async function fetchTags() {
  const data = await api("/tags");
  return data.tags || [];
}

async function fetchVips() {
  const data = await api("/vips");
  return data.vips || [];
}

async function fetchAnimals() {
  const data = await api("/animals");
  return data;
}

async function fetchCoupons() {
  const data = await api("/coupons");
  return data.coupons || [];
}

function closeMemberCouponModal() {
  memberCouponModal.classList.add("hidden");
}

async function openMemberCouponModal() {
  memberCouponModalError.textContent = "";
  memberCouponForm.reset();
  const coupons = await fetchCoupons();
  const enabled = coupons.filter((coupon) => coupon.enabled !== false);
  const select = memberCouponForm.couponId;
  select.innerHTML =
    '<option value="">請選擇優惠券</option>' +
    enabled
      .map(
        (coupon) =>
          `<option value="${escapeHtml(coupon.id)}">${escapeHtml(
            coupon.name
          )}（${escapeHtml(couponValueText(coupon))}）</option>`
      )
      .join("");
  if (!enabled.length) {
    memberCouponModalError.textContent = "請先到優惠券頁新增並啟用券種";
  }
  memberCouponModal.classList.remove("hidden");
}

async function openMemberEditModal() {
  memberEditError.textContent = "";
  hideMemberTagCreate();
  const user = currentMember || {};
  memberEditForm.displayName.value = user.displayName || "";
  memberEditForm.mobile.value = user.mobile || "";
  memberEditForm.birthday.value = user.birthday || "";
  memberEditForm.prepaidFeed.value = user.prepaidFeed ?? 0;
  memberEditForm.storedCredit.value = user.storedCredit ?? 0;
  const [tags, vips] = await Promise.all([
    fetchTags(),
    fetchVips(),
  ]);
  fillVipSelect(vips, user.vip?.id || user.vip);
  renderMemberTagOptions(
    tags,
    (user.tags || []).map((tag) => tag.id)
  );
  memberEditModal.classList.remove("hidden");
}

function closeMemberEditModal() {
  memberEditModal.classList.add("hidden");
  hideMemberTagCreate();
}

async function openMemberAnimalModal() {
  memberAnimalError.textContent = "";
  const user = currentMember || {};
  const animalData = await fetchAnimals();
  renderMemberAnimalOptions(
    animalData,
    (user.animals || []).map((animal) => animal.id)
  );
  memberAnimalModal.classList.remove("hidden");
}

function closeMemberAnimalModal() {
  memberAnimalModal.classList.add("hidden");
}

function renderMemberCoupons(coupons) {
  const rows = document.getElementById("member-coupon-rows");
  document.getElementById("member-coupon-error").textContent = "";

  if (!coupons.length) {
    rows.innerHTML = '<tr><td colspan="5" class="empty">尚未持有優惠券</td></tr>';
    return;
  }

  rows.innerHTML = coupons
    .map((coupon) => {
      const canUse = coupon.status === "available";
      return `<tr>
        <td>${escapeHtml(coupon.name)}</td>
        <td>${escapeHtml(couponTypeLabel(coupon.type))} ${escapeHtml(couponValueText(coupon))}</td>
        <td>${escapeHtml(COUPON_STATUS_LABELS[coupon.status] || coupon.status)}</td>
        <td>${escapeHtml(formatDay(coupon.expiresAt))}</td>
        <td>${
          canUse
            ? `<button class="ghost" type="button" data-use-coupon="${escapeHtml(coupon.id)}" data-use-name="${escapeHtml(coupon.name)}">核銷</button>`
            : ""
        }</td>
      </tr>`;
    })
    .join("");
}

function renderMemberDetail(user, transactions, coupons) {
  currentMember = user;
  document.getElementById("member-name").textContent = user.displayName || "會員詳情";
  document.getElementById("member-mobile").textContent = user.mobile || "—";
  document.getElementById("member-line").innerHTML = lineStatusHtml(user);
  document.getElementById("member-birthday").textContent = user.birthday || "—";
  document.getElementById("member-vip").textContent = vipName(user);
  document.getElementById("member-spend").textContent = user.totalSpend ?? 0;
  document.getElementById("member-prepaid-feed").textContent = user.prepaidFeed ?? 0;
  document.getElementById("member-stored-credit").textContent = user.storedCredit ?? 0;

  const tagBox = document.getElementById("member-tags");
  const tags = user.tags || [];
  tagBox.innerHTML = tags.length
    ? tags.map((tag) => `<span class="chip">${escapeHtml(tag.name)}</span>`).join("")
    : '<span class="muted">尚無標籤</span>';

  const productBox = document.getElementById("member-products");
  const animals = user.animals || [];
  productBox.innerHTML = animals.length
    ? animals
        .map((animal) => `<span class="chip">${escapeHtml(animal.name)}</span>`)
        .join("")
    : '<span class="muted">尚未選擇</span>';

  renderMemberCoupons(coupons || []);

  const avatarEl = document.getElementById("member-avatar");
  if (user.avatarUrl) {
    avatarEl.outerHTML = `<img class="avatar-lg" id="member-avatar" src="${escapeHtml(user.avatarUrl)}" alt="" />`;
  } else {
    avatarEl.outerHTML = `<span class="avatar-lg" id="member-avatar"></span>`;
  }

  const rows = document.getElementById("transaction-rows");
  if (!transactions.length) {
    rows.innerHTML = '<tr><td colspan="6" class="empty">尚無交易紀錄</td></tr>';
    return;
  }

  rows.innerHTML = transactions
    .map((tx) => {
      const items = (tx.items || [])
        .map((item) => `${item.name || "未命名"} × ${item.quantity ?? 0}`)
        .join("、");
      return `<tr>
        <td>${escapeHtml(tx.orderNo || tx.externalOrderId || "—")}</td>
        <td>${escapeHtml(branchName(tx))}</td>
        <td>${escapeHtml(items || "無品項")}</td>
        <td>${escapeHtml(tx.totalAmount ?? 0)}</td>
        <td>${escapeHtml(tx.orderStatus || "—")}</td>
        <td>${escapeHtml(formatDate(tx.createdAt || tx.importedAt))}</td>
      </tr>`;
    })
    .join("");
}

async function loadMemberDetail(id) {
  try {
    const data = await api(`/users/${id}`);
    renderMemberDetail(data.user, data.transactions || [], data.coupons || []);
  } catch (error) {
    document.getElementById("member-name").textContent = "找不到會員";
    document.getElementById("transaction-rows").innerHTML =
      `<tr><td colspan="6" class="empty">${escapeHtml(error.message)}</td></tr>`;
  }
}

document.getElementById("member-coupon-issue-btn").addEventListener("click", async () => {
    try {
      await openMemberCouponModal();
    } catch (error) {
      document.getElementById("member-coupon-error").textContent = error.message;
    }
  });

  document.getElementById("member-coupon-cancel-btn").addEventListener("click", () => {
    closeMemberCouponModal();
  });

  bindModalDismiss(memberCouponModal, closeMemberCouponModal);

  memberCouponForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    memberCouponModalError.textContent = "";

    if (!currentMember?.id) {
      memberCouponModalError.textContent = "找不到會員";
      return;
    }

    try {
      await api(`/users/${currentMember.id}/coupons`, {
        method: "POST",
        toast: "優惠券已發放",
        body: JSON.stringify({
          couponId: memberCouponForm.couponId.value,
          expiresAt: memberCouponForm.expiresAt.value,
        }),
      });
      closeMemberCouponModal();
      await loadMemberDetail(currentMember.id);
    } catch (error) {
      memberCouponModalError.textContent = error.message;
    }
  });

  document.getElementById("member-coupon-rows").addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-use-coupon]");
    if (!btn) return;

    const name = btn.dataset.useName || "這張優惠券";
    if (!confirm(`確定核銷「${name}」？`)) return;

    document.getElementById("member-coupon-error").textContent = "";
    try {
      await api(`/user-coupons/${btn.dataset.useCoupon}/use`, {
        method: "POST",
        toast: "優惠券已核銷",
      });
      if (currentMember?.id) await loadMemberDetail(currentMember.id);
    } catch (error) {
      document.getElementById("member-coupon-error").textContent = error.message;
    }
  });

  document.getElementById("member-tag-add-btn").addEventListener("click", () => {
    memberTagCreateError.textContent = "";
    memberTagCreate.classList.toggle("hidden");
  });

  document.getElementById("member-tag-create-cancel").addEventListener("click", () => {
    hideMemberTagCreate();
  });

  document.getElementById("member-tag-create-save").addEventListener("click", async () => {
    memberTagCreateError.textContent = "";
    const name = document.getElementById("member-tag-new-name").value.trim();
    if (!name) {
      memberTagCreateError.textContent = "請輸入名稱";
      return;
    }

    try {
      const data = await api("/tags", {
        method: "POST",
        toast: "標籤已新增",
        body: JSON.stringify({
          name,
          description: document.getElementById("member-tag-new-desc").value,
        }),
      });
      const selected = selectedMemberTagIds();
      if (data.tag?.id) selected.push(data.tag.id);
      hideMemberTagCreate();
      const tags = await fetchTags();
      renderMemberTagOptions(tags, selected);
    } catch (error) {
      memberTagCreateError.textContent = error.message;
    }
  });

  document.getElementById("member-edit-open-btn").addEventListener("click", async () => {
    try {
      await openMemberEditModal();
    } catch (error) {
      memberEditError.textContent = error.message;
      memberEditModal.classList.remove("hidden");
    }
  });

  document.getElementById("member-edit-cancel-btn").addEventListener("click", () => {
    closeMemberEditModal();
  });

bindModalDismiss(memberEditModal, closeMemberEditModal);
bindModalDismiss(memberAnimalModal, closeMemberAnimalModal);

document.getElementById("member-animal-open-btn").addEventListener("click", async () => {
  try {
    await openMemberAnimalModal();
  } catch (error) {
    memberAnimalError.textContent = error.message;
    memberAnimalModal.classList.remove("hidden");
  }
});

document.getElementById("member-animal-cancel-btn").addEventListener("click", () => {
  closeMemberAnimalModal();
});

memberAnimalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberAnimalError.textContent = "";

  if (!currentMember?.id) {
    memberAnimalError.textContent = "找不到會員";
    return;
  }

  try {
    await api(`/users/${currentMember.id}`, {
      method: "POST",
      toast: "偏好物種已更新",
      body: JSON.stringify({
        animalIds: selectedMemberAnimalIds(),
      }),
    });
    closeMemberAnimalModal();
    await loadMemberDetail(currentMember.id);
  } catch (error) {
    memberAnimalError.textContent = error.message;
  }
});

memberEditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberEditError.textContent = "";

  if (!currentMember?.id) {
    memberEditError.textContent = "找不到會員";
    return;
  }

  try {
    await api(`/users/${currentMember.id}`, {
      method: "POST",
      toast: "會員資料已更新",
      body: JSON.stringify({
        displayName: memberEditForm.displayName.value,
        mobile: memberEditForm.mobile.value,
        birthday: memberEditForm.birthday.value,
        prepaidFeed: memberEditForm.prepaidFeed.value,
        storedCredit: memberEditForm.storedCredit.value,
        vipId: memberEditForm.vipId.value,
        tagIds: selectedMemberTagIds(),
      }),
    });
    closeMemberEditModal();
    await loadMemberDetail(currentMember.id);
  } catch (error) {
    memberEditError.textContent = error.message;
  }
});

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  const memberId = memberIdFromPath();
  if (!memberId) {
    location.replace("/members");
    return;
  }

  try {
    await loadMemberDetail(memberId);
  } catch {
    /* page data failed independently of auth */
  }
}

init();
