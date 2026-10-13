const { api, escapeHtml, requireAuth, bindModalDismiss, formatDate } = window.Manager;

const reviewRows = document.getElementById("review-rows");
const reviewModal = document.getElementById("review-modal");
const reviewForm = document.getElementById("review-form");
const reviewError = document.getElementById("review-error");
const reviewMember = document.getElementById("review-member");
let cachedSpecies = [];
let cachedReviews = [];
let approvingReviewId = null;

function isRoot(item) {
  return !item.parentId;
}

function memberLabel(review) {
  const name = review.displayName || "未命名";
  return review.mobile ? `${name} ${review.mobile}` : name;
}

function renderReviews(reviews) {
  if (!reviews.length) {
    reviewRows.innerHTML = '<tr><td colspan="4" class="empty">目前沒有待審項目</td></tr>';
    return;
  }

  reviewRows.innerHTML = reviews
    .map((review) => {
      const member = review.userId
        ? `<a class="review-member" href="/members/${escapeHtml(review.userId)}">${escapeHtml(memberLabel(review))}</a>`
        : escapeHtml(memberLabel(review));

      return `<tr>
        <td>${escapeHtml(review.name)}</td>
        <td>${member}</td>
        <td>${escapeHtml(formatDate(review.createdAt))}</td>
        <td>
          <div class="review-actions">
            <button type="button" data-review-action="approve" data-id="${escapeHtml(review.id)}">通過</button>
            <button class="ghost danger" type="button" data-review-action="reject" data-id="${escapeHtml(review.id)}">駁回</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

async function loadSpecies() {
  const data = await api("/species");
  cachedSpecies = data.species || [];
  return cachedSpecies;
}

async function loadReviews() {
  const data = await api("/species/reviews");
  cachedReviews = data.reviews || [];
  renderReviews(cachedReviews);
  return cachedReviews;
}

function openReviewModal(review) {
  const roots = cachedSpecies.filter(isRoot);
  approvingReviewId = review.id;
  reviewError.textContent = "";
  reviewForm.name.value = review.name || "";
  reviewMember.textContent = memberLabel(review);
  reviewForm.parentId.innerHTML = roots.length
    ? roots
        .map(
          (root) =>
            `<option value="${escapeHtml(root.id)}">${escapeHtml(root.name)}</option>`
        )
        .join("")
    : '<option value="">請先建立大類</option>';
  reviewForm.parentId.disabled = !roots.length;
  reviewModal.classList.remove("hidden");
  reviewForm.name.focus();
}

function closeReviewModal() {
  reviewModal.classList.add("hidden");
  approvingReviewId = null;
}

reviewRows.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-review-action]");
  if (!button) return;

  const review = cachedReviews.find((item) => String(item.id) === String(button.dataset.id));
  if (!review) return;

  if (button.dataset.reviewAction === "approve") {
    openReviewModal(review);
    return;
  }

  if (!confirm(`確定駁回「${review.name}」？`)) return;

  try {
    await api(`/species/reviews/${review.id}/reject`, {
      method: "POST",
      toast: "已駁回",
      body: JSON.stringify({}),
    });
    await loadReviews();
  } catch (error) {
    window.alert(error.message);
  }
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!approvingReviewId) return;
  reviewError.textContent = "";

  if (!reviewForm.parentId.value) {
    reviewError.textContent = "請先建立大類";
    return;
  }

  try {
    await api(`/species/reviews/${approvingReviewId}/approve`, {
      method: "POST",
      toast: "已加入物種",
      body: JSON.stringify({
        name: reviewForm.name.value,
        parentId: reviewForm.parentId.value,
      }),
    });
    closeReviewModal();
    await loadReviews();
  } catch (error) {
    reviewError.textContent = error.message;
  }
});

document.getElementById("review-cancel-btn").addEventListener("click", () => {
  closeReviewModal();
});

bindModalDismiss(reviewModal, closeReviewModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await Promise.all([loadSpecies(), loadReviews()]);
  } catch {
    /* page data failed independently of auth */
  }
}

init();
