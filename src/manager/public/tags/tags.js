const { api, escapeHtml, requireAuth, bindModalDismiss } = window.Manager;

const tagForm = document.getElementById("tag-form");
const tagModal = document.getElementById("tag-modal");
const tagError = document.getElementById("tag-error");
let editingTagId = null;
let cachedTags = [];

function renderTags(tags) {
  const rows = document.getElementById("tag-rows");

  if (!tags.length) {
    rows.innerHTML = '<tr><td colspan="2" class="empty">尚無標籤</td></tr>';
    return;
  }

  rows.innerHTML = tags
    .map(
      (tag) =>
        `<tr class="clickable" data-id="${escapeHtml(tag.id)}">
          <td>${escapeHtml(tag.name)}</td>
          <td>${escapeHtml(tag.description || "—")}</td>
        </tr>`
    )
    .join("");
}

async function loadTags() {
  const data = await api("/tags");
  cachedTags = data.tags || [];
  renderTags(cachedTags);
  return cachedTags;
}

function openTagModal(tag) {
  tagError.textContent = "";
  if (tag) {
    editingTagId = tag.id;
    tagForm.name.value = tag.name || "";
    tagForm.description.value = tag.description || "";
    document.getElementById("tag-modal-title").textContent = "編輯標籤";
    document.getElementById("tag-submit-btn").textContent = "儲存";
  } else {
    editingTagId = null;
    tagForm.reset();
    document.getElementById("tag-modal-title").textContent = "新增標籤";
    document.getElementById("tag-submit-btn").textContent = "新增";
  }
  tagModal.classList.remove("hidden");
}

function closeTagModal() {
  tagModal.classList.add("hidden");
  editingTagId = null;
}

tagForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    tagError.textContent = "";

    try {
      const payload = {
        name: tagForm.name.value,
        description: tagForm.description.value,
      };
      if (editingTagId) {
        await api(`/tags/${editingTagId}`, {
          method: "POST",
          toast: "標籤已更新",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/tags", {
          method: "POST",
          toast: "標籤已新增",
          body: JSON.stringify(payload),
        });
      }
      closeTagModal();
      await loadTags();
    } catch (error) {
      tagError.textContent = error.message;
    }
  });

  document.getElementById("tag-open-btn").addEventListener("click", () => {
    openTagModal();
  });

  document.getElementById("tag-rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-id]");
    if (!row?.dataset.id) return;
    const tag = cachedTags.find((item) => String(item.id) === String(row.dataset.id));
    if (tag) openTagModal(tag);
  });

  document.getElementById("tag-cancel-btn").addEventListener("click", () => {
    closeTagModal();
  });

bindModalDismiss(tagModal, closeTagModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadTags();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
