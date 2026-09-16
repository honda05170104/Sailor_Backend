(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, escapeHtml, requireAuth, bindModalDismiss, enabledText } = M;

  const productCategoryForm = document.getElementById("product-category-form");
  const productCategoryModal = document.getElementById("product-category-modal");
  const productCategoryError = document.getElementById("product-category-error");
  const productCategoryDeleteBtn = document.getElementById("product-category-delete-btn");
  let editingProductCategoryId = null;
  const productForm = document.getElementById("product-form");
  const productModal = document.getElementById("product-modal");
  const productError = document.getElementById("product-error");
  const productDeleteBtn = document.getElementById("product-delete-btn");
  let editingProductId = null;
  let cachedProductCategories = [];
  let cachedProducts = [];

  function categoryIdOf(product) {
    return String(product.category?.id || product.categoryId || "");
  }

  function renderSpeciesRows(products) {
    if (!products.length) {
      return '<tr><td colspan="3" class="empty">此分類尚無物種</td></tr>';
    }
    return products
      .map(
        (item) =>
          `<tr class="clickable" data-product-id="${escapeHtml(item.id)}">
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.description || "—")}</td>
            <td>${enabledText(item.enabled)}</td>
          </tr>`
      )
      .join("");
  }

  function renderCategoryCard(category, products) {
    const id = escapeHtml(category.id || "");
    const status = enabledText(category.enabled);
    const desc = category.description ? escapeHtml(category.description) : "無說明";
    const actions = category.id
      ? `<div class="category-actions">
          <button class="ghost" type="button" data-edit-category="${id}">編輯分類</button>
          <button type="button" data-add-product="${id}">新增物種</button>
        </div>`
      : "";
    return `<div class="panel category-card">
      <div class="section-head">
        <div>
          <h3>${escapeHtml(category.name)}</h3>
          <p class="muted category-meta">${desc} · ${status}</p>
        </div>
        ${actions}
      </div>
      <table>
        <thead>
          <tr>
            <th>物種</th>
            <th>說明</th>
            <th>狀態</th>
          </tr>
        </thead>
        <tbody>
          ${renderSpeciesRows(products)}
        </tbody>
      </table>
    </div>`;
  }

  function renderProductGroups() {
    const root = document.getElementById("product-groups");
    if (!cachedProductCategories.length) {
      root.innerHTML = '<div class="panel"><p class="empty">尚無分類，請先新增分類</p></div>';
      return;
    }

    const grouped = new Map(cachedProductCategories.map((cat) => [String(cat.id), []]));
    const orphans = [];
    for (const product of cachedProducts) {
      const cid = categoryIdOf(product);
      if (grouped.has(cid)) grouped.get(cid).push(product);
      else orphans.push(product);
    }

    const cards = cachedProductCategories.map((cat) =>
      renderCategoryCard(cat, grouped.get(String(cat.id)) || [])
    );
    if (orphans.length) {
      cards.push(
        renderCategoryCard(
          { id: "", name: "未分類", description: "這些物種沒有所屬分類", enabled: true },
          orphans
        )
      );
    }
    root.innerHTML = cards.join("");
  }

  async function loadProducts() {
    const data = await api("/animals");
    cachedProductCategories = data.categories || [];
    cachedProducts = data.animals || [];
    renderProductGroups();
    return data;
  }

  function openProductCategoryModal(item) {
    productCategoryError.textContent = "";
    if (item) {
      editingProductCategoryId = item.id;
      productCategoryForm.name.value = item.name || "";
      productCategoryForm.description.value = item.description || "";
      productCategoryForm.enabled.checked = item.enabled !== false;
      document.getElementById("product-category-modal-title").textContent = "編輯分類";
      document.getElementById("product-category-submit-btn").textContent = "儲存";
      productCategoryDeleteBtn.classList.remove("hidden");
    } else {
      editingProductCategoryId = null;
      productCategoryForm.reset();
      productCategoryForm.enabled.checked = true;
      document.getElementById("product-category-modal-title").textContent = "新增分類";
      document.getElementById("product-category-submit-btn").textContent = "新增";
      productCategoryDeleteBtn.classList.add("hidden");
    }
    productCategoryModal.classList.remove("hidden");
  }

  window.openProductCategoryModal = openProductCategoryModal;

  function closeProductCategoryModal() {
    productCategoryModal.classList.add("hidden");
    editingProductCategoryId = null;
  }

  function openProductItemModal(item, categoryId) {
    productError.textContent = "";
    const selectedId = String(
      item?.category?.id || item?.categoryId || categoryId || ""
    );
    const category = cachedProductCategories.find(
      (entry) => String(entry.id) === selectedId
    );
    productForm.categoryId.value = selectedId;
    document.getElementById("product-category-label").textContent = category
      ? `分類：${category.name}`
      : "請先選擇分類";

    if (item) {
      editingProductId = item.id;
      productForm.name.value = item.name || "";
      productForm.description.value = item.description || "";
      productForm.enabled.checked = item.enabled !== false;
      document.getElementById("product-modal-title").textContent = "編輯物種";
      document.getElementById("product-submit-btn").textContent = "儲存";
      productDeleteBtn.classList.remove("hidden");
    } else {
      editingProductId = null;
      productForm.name.value = "";
      productForm.description.value = "";
      productForm.enabled.checked = true;
      document.getElementById("product-modal-title").textContent = "新增物種";
      document.getElementById("product-submit-btn").textContent = "新增";
      productDeleteBtn.classList.add("hidden");
    }
    if (!selectedId) {
      productError.textContent = "請先新增分類";
    }
    productModal.classList.remove("hidden");
  }

  function closeProductItemModal() {
    productModal.classList.add("hidden");
    editingProductId = null;
  }

  productCategoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    productCategoryError.textContent = "";
    try {
      const payload = {
        name: productCategoryForm.name.value,
        description: productCategoryForm.description.value,
        enabled: productCategoryForm.enabled.checked,
      };
      if (editingProductCategoryId) {
        await api(`/animal-categories/${editingProductCategoryId}`, {
          method: "POST",
          toast: "分類已更新",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/animal-categories", {
          method: "POST",
          toast: "分類已新增",
          body: JSON.stringify(payload),
        });
      }
      closeProductCategoryModal();
      await loadProducts();
    } catch (error) {
      productCategoryError.textContent = error.message;
    }
  });

  document.getElementById("product-category-open-btn").addEventListener("click", () => {
    openProductCategoryModal();
  });

  document.getElementById("product-category-cancel-btn").addEventListener("click", () => {
    closeProductCategoryModal();
  });

  productCategoryDeleteBtn.addEventListener("click", async () => {
    if (!editingProductCategoryId) return;
    const category = cachedProductCategories.find(
      (entry) => String(entry.id) === String(editingProductCategoryId)
    );
    const name = category?.name ? `「${category.name}」` : "這個分類";
    if (!window.confirm(`確定刪除${name}？分類下的物種也會一併刪除。`)) return;
    productCategoryError.textContent = "";
    try {
      await api(`/animal-categories/${editingProductCategoryId}/delete`, {
        method: "POST",
        toast: "分類已刪除",
      });
      closeProductCategoryModal();
      await loadProducts();
    } catch (error) {
      productCategoryError.textContent = error.message;
    }
  });

  bindModalDismiss(productCategoryModal, closeProductCategoryModal);

  productForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    productError.textContent = "";
    if (!productForm.categoryId.value) {
      productError.textContent = "請先新增分類";
      return;
    }
    try {
      const payload = {
        name: productForm.name.value,
        categoryId: productForm.categoryId.value,
        description: productForm.description.value,
        enabled: productForm.enabled.checked,
      };
      if (editingProductId) {
        await api(`/animals/${editingProductId}`, {
          method: "POST",
          toast: "物種已更新",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/animals", {
          method: "POST",
          toast: "物種已新增",
          body: JSON.stringify(payload),
        });
      }
      closeProductItemModal();
      await loadProducts();
    } catch (error) {
      productError.textContent = error.message;
    }
  });

  document.getElementById("product-groups").addEventListener("click", (event) => {
    const addBtn = event.target.closest("[data-add-product]");
    if (addBtn) {
      openProductItemModal(null, addBtn.dataset.addProduct);
      return;
    }
    const editCat = event.target.closest("[data-edit-category]");
    if (editCat) {
      const item = cachedProductCategories.find(
        (entry) => String(entry.id) === String(editCat.dataset.editCategory)
      );
      if (item) openProductCategoryModal(item);
      return;
    }
    const row = event.target.closest("tr[data-product-id]");
    if (!row) return;
    const item = cachedProducts.find(
      (entry) => String(entry.id) === String(row.dataset.productId)
    );
    if (item) openProductItemModal(item);
  });

  document.getElementById("product-cancel-btn").addEventListener("click", () => {
    closeProductItemModal();
  });

  productDeleteBtn.addEventListener("click", async () => {
    if (!editingProductId) return;
    const animal = cachedProducts.find(
      (entry) => String(entry.id) === String(editingProductId)
    );
    const name = animal?.name ? `「${animal.name}」` : "這個物種";
    if (!window.confirm(`確定刪除${name}？`)) return;
    productError.textContent = "";
    try {
      await api(`/animals/${editingProductId}/delete`, {
        method: "POST",
        toast: "物種已刪除",
      });
      closeProductItemModal();
      await loadProducts();
    } catch (error) {
      productError.textContent = error.message;
    }
  });

  bindModalDismiss(productModal, closeProductItemModal);

  async function init() {
    const manager = await requireAuth();
    if (!manager) return;

    try {
      await loadProducts();
    } catch {
      /* page data failed independently of auth */
    }
  }

  init();
})();
