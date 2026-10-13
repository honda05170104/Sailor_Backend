const { api, escapeHtml, requireAuth, bindModalDismiss } = window.Manager;

const speciesForm = document.getElementById("species-form");
const speciesModal = document.getElementById("species-modal");
const speciesError = document.getElementById("species-error");
const speciesParentHint = document.getElementById("species-parent-hint");
const speciesDeleteBtn = document.getElementById("species-delete-btn");
const speciesBoard = document.getElementById("species-board");
let editingSpeciesId = null;
let creatingParentId = "";
let cachedSpecies = [];

function isRoot(item) {
  return !item.parentId;
}

function statusHtml(enabled) {
  return enabled === false
    ? '<span class="species-status">停用</span>'
    : '<span class="species-status is-on">啟用</span>';
}

function groupSpecies(species) {
  const childrenByParent = new Map();
  for (const item of species) {
    if (isRoot(item)) continue;
    const key = String(item.parentId);
    const list = childrenByParent.get(key) || [];
    list.push(item);
    childrenByParent.set(key, list);
  }

  return species.filter(isRoot).map((root) => ({
    ...root,
    children: childrenByParent.get(String(root.id)) || [],
  }));
}

function renderSpecies(species) {
  const groups = groupSpecies(species);

  if (!groups.length) {
    speciesBoard.innerHTML = '<p class="empty">尚無大類</p>';
    return;
  }

  speciesBoard.innerHTML = groups
    .map((group) => {
      const children = group.children.length
        ? group.children
            .map(
              (child) => `<li>
                <button class="species-child${child.enabled === false ? " is-off" : ""}" type="button" data-action="edit" data-id="${escapeHtml(child.id)}">
                  <span class="species-child-name">${escapeHtml(child.name)}</span>
                  ${statusHtml(child.enabled)}
                </button>
              </li>`
            )
            .join("")
        : '<li class="species-empty">尚無小類</li>';

      return `<article class="species-card${group.enabled === false ? " is-off" : ""}">
        <button class="species-card-head" type="button" data-action="edit" data-id="${escapeHtml(group.id)}">
          <h3>${escapeHtml(group.name)}</h3>
          ${statusHtml(group.enabled)}
        </button>
        <ul class="species-children">${children}</ul>
        <button class="ghost species-add-child" type="button" data-action="add-child" data-parent="${escapeHtml(group.id)}">新增小類</button>
      </article>`;
    })
    .join("");
}

async function loadSpecies() {
  const data = await api("/species");
  cachedSpecies = data.species || [];
  renderSpecies(cachedSpecies);
  return cachedSpecies;
}

function openSpeciesModal(species, parentId = "") {
  speciesError.textContent = "";
  creatingParentId = "";

  if (species) {
    editingSpeciesId = species.id;
    creatingParentId = species.parentId ? String(species.parentId) : "";
    speciesForm.name.value = species.name || "";
    speciesForm.sortOrder.value = species.sortOrder ?? 0;
    speciesForm.enabled.checked = species.enabled !== false;
    const parent = cachedSpecies.find((item) => String(item.id) === creatingParentId);
    document.getElementById("species-modal-title").textContent = parent ? "編輯小類" : "編輯大類";
    speciesParentHint.textContent = parent ? `屬於「${parent.name}」` : "";
    document.getElementById("species-submit-btn").textContent = "儲存";
    speciesDeleteBtn.classList.remove("hidden");
  } else {
    editingSpeciesId = null;
    creatingParentId = parentId ? String(parentId) : "";
    speciesForm.reset();
    speciesForm.sortOrder.value = "0";
    speciesForm.enabled.checked = true;
    const parent = cachedSpecies.find((item) => String(item.id) === creatingParentId);
    document.getElementById("species-modal-title").textContent = parent ? "新增小類" : "新增大類";
    speciesParentHint.textContent = parent ? `加在「${parent.name}」裡` : "";
    document.getElementById("species-submit-btn").textContent = "新增";
    speciesDeleteBtn.classList.add("hidden");
  }

  speciesParentHint.classList.toggle("hidden", !speciesParentHint.textContent);
  speciesModal.classList.remove("hidden");
  speciesForm.name.focus();
}

function closeSpeciesModal() {
  speciesModal.classList.add("hidden");
  editingSpeciesId = null;
  creatingParentId = "";
  speciesDeleteBtn.classList.add("hidden");
}

speciesDeleteBtn.addEventListener("click", async () => {
  if (!editingSpeciesId) return;
  const current = cachedSpecies.find((item) => String(item.id) === String(editingSpeciesId));
  const label = current?.name || "這個項目";
  if (!confirm(`確定刪除「${label}」？`)) return;
  speciesError.textContent = "";

  try {
    await api(`/species/${editingSpeciesId}/delete`, {
      method: "POST",
      toast: "已刪除",
      body: JSON.stringify({}),
    });
    closeSpeciesModal();
    await loadSpecies();
  } catch (error) {
    speciesError.textContent = error.message;
  }
});

speciesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  speciesError.textContent = "";

  const payload = {
    name: speciesForm.name.value,
    parentId: creatingParentId,
    sortOrder: speciesForm.sortOrder.value,
    enabled: speciesForm.enabled.checked,
  };

  try {
    if (editingSpeciesId) {
      await api(`/species/${editingSpeciesId}`, {
        method: "POST",
        toast: "已更新",
        body: JSON.stringify(payload),
      });
    } else {
      await api("/species", {
        method: "POST",
        toast: creatingParentId ? "小類已新增" : "大類已新增",
        body: JSON.stringify(payload),
      });
    }
    closeSpeciesModal();
    await loadSpecies();
  } catch (error) {
    speciesError.textContent = error.message;
  }
});

document.getElementById("species-open-btn").addEventListener("click", () => {
  openSpeciesModal(null, "");
});

speciesBoard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "add-child") {
    openSpeciesModal(null, button.dataset.parent);
    return;
  }

  const species = cachedSpecies.find((item) => String(item.id) === String(button.dataset.id));
  if (species) openSpeciesModal(species);
});

document.getElementById("species-cancel-btn").addEventListener("click", () => {
  closeSpeciesModal();
});

bindModalDismiss(speciesModal, closeSpeciesModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadSpecies();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
