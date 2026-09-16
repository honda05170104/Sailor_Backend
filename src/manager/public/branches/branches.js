const { api, escapeHtml, requireAuth, bindModalDismiss, branchTypeLabel } = window.Manager;

const branchForm = document.getElementById("branch-form");
const branchModal = document.getElementById("branch-modal");
const branchError = document.getElementById("branch-error");
let cachedBranches = [];

function renderBranches(branches) {
  const rows = document.getElementById("branch-rows");

  if (!branches.length) {
    rows.innerHTML = '<tr><td colspan="2" class="empty">尚無分店</td></tr>';
    return;
  }

  rows.innerHTML = branches
    .map(
      (branch) =>
        `<tr>
          <td>${escapeHtml(branch.name)}</td>
          <td>${escapeHtml(branchTypeLabel(branch.type))}</td>
        </tr>`
    )
    .join("");
}

async function loadBranches() {
  const data = await api("/branches");
  cachedBranches = data.branches || [];
  renderBranches(cachedBranches);
  return cachedBranches;
}

function openBranchModal() {
  branchError.textContent = "";
  branchForm.reset();
  branchModal.classList.remove("hidden");
}

function closeBranchModal() {
  branchModal.classList.add("hidden");
}

branchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    branchError.textContent = "";

    try {
      await api("/branches", {
        method: "POST",
        toast: "分店已新增",
        body: JSON.stringify({
          name: branchForm.name.value,
          type: branchForm.type.value,
        }),
      });
      closeBranchModal();
      await loadBranches();
    } catch (error) {
      branchError.textContent = error.message;
    }
  });

  document.getElementById("branch-open-btn").addEventListener("click", () => {
    openBranchModal();
  });

  document.getElementById("branch-cancel-btn").addEventListener("click", () => {
    closeBranchModal();
  });

bindModalDismiss(branchModal, closeBranchModal);

async function init() {
  const manager = await requireAuth();
  if (!manager) return;

  try {
    await loadBranches();
  } catch {
    /* page data failed independently of auth */
  }
}

init();
