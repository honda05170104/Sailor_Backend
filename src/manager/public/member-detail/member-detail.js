const {
  api,
  escapeHtml,
  requireAuth,
  bindModalDismiss,
  vipName,
  lineStatusHtml,
  couponTypeLabel,
  couponValueText,
  couponSourceLabel,
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
const memberFeedForm = document.getElementById("member-feed-form");
const memberFeedModal = document.getElementById("member-feed-modal");
const memberFeedError = document.getElementById("member-feed-error");
const memberCreditForm = document.getElementById("member-credit-form");
const memberCreditModal = document.getElementById("member-credit-modal");
const memberCreditError = document.getElementById("member-credit-error");
const memberAccountForm = document.getElementById("member-account-form");
const memberAccountError = document.getElementById("member-account-error");
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
  return [...memberAccountForm.querySelectorAll('input[name="tagIds"]:checked')].map(
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
    .map((tag) => {
      const on = selectedSet.has(String(tag.id));
      return `<label class="tag-chip${on ? " is-on" : ""}">
          <input type="checkbox" name="tagIds" value="${escapeHtml(tag.id)}" ${
            on ? "checked" : ""
          } />
          ${escapeHtml(tag.name)}
        </label>`;
    })
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
  const user = currentMember || {};
  memberEditForm.displayName.value = user.displayName || "";
  memberEditForm.mobile.value = user.mobile || "";
  memberEditForm.birthday.value = user.birthday || "";
  const vips = await fetchVips();
  fillVipSelect(vips, user.vip?.id || user.vip);
  memberEditModal.classList.remove("hidden");
}

function closeMemberEditModal() {
  memberEditModal.classList.add("hidden");
}

async function fillAccountForm(user) {
  document.getElementById("member-prepaid-feed").textContent = user.prepaidFeed ?? 0;
  document.getElementById("member-stored-credit").textContent = user.storedCredit ?? 0;
  const tags = await fetchTags();
  renderMemberTagOptions(
    tags,
    (user.tags || []).map((tag) => tag.id)
  );
}

async function openMemberFeedModal() {
  memberFeedError.textContent = "";
  memberFeedForm.prepaidFeed.value = currentMember?.prepaidFeed ?? 0;
  memberFeedModal.classList.remove("hidden");
}

function closeMemberFeedModal() {
  memberFeedModal.classList.add("hidden");
}

async function openMemberCreditModal() {
  memberCreditError.textContent = "";
  memberCreditForm.reset();
  memberCreditForm.amount.value = "";
  setCreditDirection("add");
  document.getElementById("credit-current-balance").textContent =
    currentMember?.storedCredit ?? 0;
  memberCreditModal.classList.remove("hidden");
}

function setCreditDirection(direction) {
  const next = direction === "subtract" ? "subtract" : "add";
  document.getElementById("credit-direction").value = next;
  document.querySelectorAll(".credit-tab").forEach((tab) => {
    const active = tab.dataset.direction === next;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.getElementById("credit-submit-btn").textContent =
    next === "subtract" ? "扣除" : "增加";
}

function closeMemberCreditModal() {
  memberCreditModal.classList.add("hidden");
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
    rows.innerHTML = '<p class="muted coupon-empty">尚未持有優惠券</p>';
    return;
  }

  rows.innerHTML = coupons
    .map((coupon) => {
      const canUse = coupon.status === "available";
      const statusClass =
        coupon.status === "available"
          ? "is-available"
          : coupon.status === "used"
            ? "is-used"
            : "is-expired";
      return `<article class="coupon-card ${statusClass}">
        <div class="coupon-card-top">
          <div class="coupon-card-meta">
            <span class="coupon-card-source">${escapeHtml(couponSourceLabel(coupon))}</span>
            <span class="coupon-card-status">${escapeHtml(COUPON_STATUS_LABELS[coupon.status] || coupon.status)}</span>
          </div>
          ${
            canUse
              ? `<button class="ghost" type="button" data-use-coupon="${escapeHtml(coupon.id)}" data-use-name="${escapeHtml(coupon.name)}">核銷</button>`
              : ""
          }
        </div>
        <h4 class="coupon-card-name">${escapeHtml(coupon.name)}</h4>
        <p class="coupon-card-value">${escapeHtml(couponTypeLabel(coupon.type))} ${escapeHtml(couponValueText(coupon))}</p>
        <p class="coupon-card-expire">到期 ${escapeHtml(formatDay(coupon.expiresAt))}</p>
      </article>`;
    })
    .join("");
}

function renderMemberDetail(user, transactions, coupons) {
  currentMember = user;
  document.getElementById("member-name").textContent = user.displayName || "會員詳情";
  document.getElementById("member-mobile").textContent = user.mobile || "—";
  document.getElementById("member-line").innerHTML = lineStatusHtml(user);
  document.getElementById("member-last-used").textContent = formatDate(user.lastUsedAt);
  document.getElementById("member-birthday").textContent = user.birthday || "—";
  document.getElementById("member-vip").textContent = vipName(user);
  document.getElementById("member-spend").textContent = user.totalSpend ?? 0;

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
    rows.innerHTML = '<tr><td colspan="7" class="empty">尚無交易紀錄</td></tr>';
    return;
  }

  rows.innerHTML = transactions
    .map((tx) => {
      const items = (tx.items || [])
        .map((item) => {
          const name = item.name || "未命名";
          if (
            name === "點數增加" ||
            name === "點數扣除" ||
            name === "點數兌換" ||
            name === "點數回饋" ||
            name === "現金回饋" ||
            name === "儲值金增加" ||
            name === "儲值金扣除"
          ) {
            return name;
          }
          if (name === "儲值金增加" || name === "儲值金扣除") return name;
          return `${name} × ${item.quantity ?? 0}`;
        })
        .join("、");
      return `<tr>
        <td>${escapeHtml(tx.txnNo || "—")}</td>
        <td>${escapeHtml(branchName(tx))}</td>
        <td>${escapeHtml(items || "無品項")}</td>
        <td>${escapeHtml(tx.totalAmount ?? 0)}</td>
        <td>${escapeHtml(tx.paymentMethod || "—")}</td>
        <td>${escapeHtml(tx.orderStatusLabel || tx.orderStatus || "—")}</td>
        <td>${escapeHtml(formatDate(tx.createdAt || tx.importedAt))}</td>
      </tr>`;
    })
    .join("");
}

async function loadMemberDetail(id) {
  try {
    const data = await api(`/users/${id}`);
    renderMemberDetail(data.user, data.transactions || [], data.coupons || []);
    try {
      await fillAccountForm(data.user);
    } catch (error) {
      memberAccountError.textContent = error.message;
    }
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

  memberTagCreate.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
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
bindModalDismiss(memberFeedModal, closeMemberFeedModal);
bindModalDismiss(memberCreditModal, closeMemberCreditModal);
bindModalDismiss(memberAnimalModal, closeMemberAnimalModal);

document.getElementById("member-tag-options").addEventListener("change", (event) => {
  const input = event.target.closest('input[name="tagIds"]');
  if (!input) return;
  input.closest(".tag-chip")?.classList.toggle("is-on", input.checked);
});

document.getElementById("member-feed-open-btn").addEventListener("click", async () => {
  try {
    await openMemberFeedModal();
  } catch (error) {
    memberFeedError.textContent = error.message;
    memberFeedModal.classList.remove("hidden");
  }
});

document.getElementById("member-feed-cancel-btn").addEventListener("click", () => {
  closeMemberFeedModal();
});

memberFeedForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberFeedError.textContent = "";

  if (!currentMember?.id) {
    memberFeedError.textContent = "找不到會員";
    return;
  }

  const prepaidFeed = Number(memberFeedForm.prepaidFeed.value);
  if (prepaidFeed === (currentMember.prepaidFeed ?? 0)) {
    closeMemberFeedModal();
    return;
  }

  try {
    await api(`/users/${currentMember.id}`, {
      method: "POST",
      toast: "餌料寄杯已更新",
      body: JSON.stringify({ prepaidFeed }),
    });
    closeMemberFeedModal();
    await loadMemberDetail(currentMember.id);
  } catch (error) {
    memberFeedError.textContent = error.message;
  }
});

document.getElementById("member-credit-open-btn").addEventListener("click", async () => {
  try {
    await openMemberCreditModal();
  } catch (error) {
    memberCreditError.textContent = error.message;
    memberCreditModal.classList.remove("hidden");
  }
});

document.getElementById("member-credit-cancel-btn").addEventListener("click", () => {
  closeMemberCreditModal();
});

document.querySelectorAll(".credit-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setCreditDirection(tab.dataset.direction);
  });
});

memberCreditForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberCreditError.textContent = "";

  if (!currentMember?.id) {
    memberCreditError.textContent = "找不到會員";
    return;
  }

  const amount = Number(memberCreditForm.amount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    memberCreditError.textContent = "請輸入大於 0 的金額";
    return;
  }

  const direction = document.getElementById("credit-direction").value;
  const delta = direction === "subtract" ? -amount : amount;

  try {
    await api(`/users/${currentMember.id}`, {
      method: "POST",
      toast: direction === "subtract" ? "已扣除點數" : "已增加點數",
      body: JSON.stringify({
        storedCreditDelta: delta,
      }),
    });
    closeMemberCreditModal();
    await loadMemberDetail(currentMember.id);
  } catch (error) {
    memberCreditError.textContent = error.message;
  }
});

memberAccountForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  memberAccountError.textContent = "";

  if (!currentMember?.id) {
    memberAccountError.textContent = "找不到會員";
    return;
  }

  try {
    await api(`/users/${currentMember.id}/tags`, {
      method: "POST",
      toast: "標籤已更新",
      body: JSON.stringify({
        tagIds: selectedMemberTagIds(),
      }),
    });
    await loadMemberDetail(currentMember.id);
  } catch (error) {
    memberAccountError.textContent = error.message;
  }
});

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
        vipId: memberEditForm.vipId.value,
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
