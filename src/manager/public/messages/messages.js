(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, escapeHtml, requireAuth, showToast, vipName, lineStatusHtml, isLineLinked } = M;

  const form = document.getElementById("message-form");
  const summary = document.getElementById("message-summary");
  const selectedInfo = document.getElementById("message-selected");
  const sendButton = document.getElementById("message-send");
  const textMessageSection = document.getElementById("text-message-section");
  const couponMessageSection = document.getElementById("coupon-message-section");
  const couponSelect = document.getElementById("coupon-select");
  let cachedUsers = [];
  let selectedUserIds = new Set();
  let loading = false;

  function filterParams() {
    const params = new URLSearchParams();
    const q = document.getElementById("message-search").value.trim();
    const vip = document.getElementById("message-vip-filter").value;
    const line = document.getElementById("message-line-filter").value;
    if (q) params.set("q", q);
    if (vip) params.set("vip", vip);
    if (line) params.set("line", line);
    return params;
  }

  function reachableCount(users) {
    return users.filter((user) => isLineLinked(user)).length;
  }

  function renderSummary(users) {
    const reachable = reachableCount(users);
    const skipped = users.length - reachable;
    if (!users.length) {
      summary.textContent = "沒有符合的會員";
      return;
    }
    const skipText = skipped ? `，未開通 LINE 的 ${skipped} 人不會收到` : "";
    summary.textContent = `符合 ${users.length} 人，可發送 ${reachable} 人${skipText}`;
  }

  function updateSelectAllState() {
    const selectAll = document.getElementById("select-all");
    const checkboxes = document.querySelectorAll(".user-select");
    const checkedCount = document.querySelectorAll(".user-select:checked").length;
    selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  function updateSelectedInfo() {
    const selected = getSelectedUsers();
    const reachable = selected.filter(user => isLineLinked(user)).length;
    if (selected.length === 0) {
      selectedInfo.textContent = "尚未選取會員";
      sendButton.disabled = true;
    } else {
      selectedInfo.textContent = `已選取 ${selected.length} 人，可發送 ${reachable} 人`;
      sendButton.disabled = loading || reachable === 0;
    }
  }

  function getSelectedUsers() {
    return cachedUsers.filter(user => selectedUserIds.has(user.id));
  }

  function renderUsers(users) {
    const rows = document.getElementById("message-rows");
    cachedUsers = users;
    renderSummary(users);

    if (!users.length) {
      rows.innerHTML = '<tr><td colspan="5" class="empty">找不到符合的會員</td></tr>';
      selectedInfo.textContent = "尚未選取會員";
      sendButton.disabled = true;
      return;
    }

    rows.innerHTML = users
      .map((user) => {
        const checked = selectedUserIds.has(user.id) ? "checked" : "";
        return `<tr data-user-id="${escapeHtml(user.id)}">
        <td><input type="checkbox" class="user-select" value="${escapeHtml(user.id)}" ${checked} /></td>
        <td>${escapeHtml(user.mobile || "—")}</td>
        <td>${escapeHtml(user.displayName || "—")}</td>
        <td>${escapeHtml(vipName(user))}</td>
        <td>${lineStatusHtml(user)}</td>
      </tr>`;
      })
      .join("");
      
    updateSelectAllState();
    updateSelectedInfo();
  }

  async function loadUsers() {
    loading = true;
    sendButton.disabled = true;
    const params = filterParams();
    const query = params.toString();
    const data = await api(`/users${query ? `?${query}` : ""}`);
    cachedUsers = data.users || [];
    loading = false;
    renderUsers(cachedUsers);
  }

  function fillVipOptions(vips) {
    const select = document.getElementById("message-vip-filter");
    const current = select.value;
    select.innerHTML =
      '<option value="">全部等級</option>' +
      vips
        .map(
          (vip) =>
            `<option value="${escapeHtml(vip.slug)}">${escapeHtml(vip.name)}</option>`
        )
        .join("");
    if (current) select.value = current;
  }


  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const selected = getSelectedUsers();
    const reachable = selected.filter(user => isLineLinked(user));
    
    if (!reachable.length || loading) return;
    
    const messageType = document.querySelector('input[name="messageType"]:checked').value;
    let requestData = {};
    let endpoint = "/messages/broadcast";
    let confirmMessage = "";
    
    if (messageType === 'text') {
      const text = document.getElementById("message-text").value.trim();
      if (!text) {
        showToast("請輸入訊息內容", "error");
        return;
      }
      requestData.text = text;
      confirmMessage = `確定要發送文字訊息給 ${reachable.length} 位會員嗎？`;
    } else {
      const couponId = couponSelect.value;
      if (!couponId) {
        showToast("請選擇優惠券", "error");
        return;
      }
      requestData.couponId = couponId;
      endpoint = "/messages/broadcast-coupon";
      const selectedCouponText = couponSelect.options[couponSelect.selectedIndex].text;
      confirmMessage = `確定要發送優惠券「${selectedCouponText}」給 ${reachable.length} 位會員嗎？`;
    }
    
    const ok = window.confirm(confirmMessage);
    if (!ok) return;

    sendButton.disabled = true;
    try {
      const lineUserIds = reachable.map(user => user.lineUserId).filter(Boolean);
      requestData.userIds = lineUserIds;
      
      const result = await api(endpoint, {
        method: "POST",
        toast: false,
        body: JSON.stringify(requestData),
      });
      
      const successMessage = messageType === 'coupon' 
        ? `已發送優惠券給 ${result.sent} 人`
        : `已送出給 ${result.sent} 人`;
        
      selectedInfo.textContent = `${successMessage}${
        result.skipped ? `，略過 ${result.skipped} 人` : ""
      }`;
      showToast(successMessage);
      
      // 清空表單
      document.getElementById("message-text").value = "";
      couponSelect.value = "";
      selectedUserIds.clear();
      updateSelectAllState();
      updateSelectedInfo();
    } catch (error) {
      selectedInfo.textContent = error.message;
      showToast(error.message, "error");
    } finally {
      sendButton.disabled = getSelectedUsers().filter(user => isLineLinked(user)).length === 0;
    }
  });

  let searchTimer = null;
  document.getElementById("message-search").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadUsers().catch((error) => {
        summary.textContent = error.message;
      });
    }, 300);
  });

  document.getElementById("message-vip-filter").addEventListener("change", () => {
    loadUsers().catch((error) => {
      summary.textContent = error.message;
    });
  });

  document.getElementById("message-line-filter").addEventListener("change", () => {
    loadUsers().catch((error) => {
      summary.textContent = error.message;
    });
  });

  document.getElementById("select-all").addEventListener("change", (event) => {
    const checked = event.target.checked;
    document.querySelectorAll(".user-select").forEach((checkbox) => {
      checkbox.checked = checked;
      if (checked) {
        selectedUserIds.add(checkbox.value);
      } else {
        selectedUserIds.delete(checkbox.value);
      }
    });
    updateSelectedInfo();
  });

  document.getElementById("message-rows").addEventListener("change", (event) => {
    if (event.target.classList.contains("user-select")) {
      if (event.target.checked) {
        selectedUserIds.add(event.target.value);
      } else {
        selectedUserIds.delete(event.target.value);
      }
      updateSelectAllState();
      updateSelectedInfo();
    }
  });

  // 訊息類型切換
  document.querySelectorAll('input[name="messageType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTextMode = radio.value === 'text';
      textMessageSection.style.display = isTextMode ? 'block' : 'none';
      couponMessageSection.style.display = isTextMode ? 'none' : 'block';
      
      // 清空驗證狀態
      document.getElementById("message-text").required = isTextMode;
      couponSelect.required = !isTextMode;
    });
  });

  // 載入優惠券選項
  async function loadCoupons() {
    try {
      const data = await api("/coupons");
      couponSelect.innerHTML = '<option value="">選擇要發送的優惠券</option>';
      data.coupons.forEach(coupon => {
        const option = document.createElement('option');
        option.value = coupon.id;
        option.textContent = `${coupon.name} - ${coupon.type === 'percent' ? coupon.value + '%' : 'NT$' + coupon.value}`;
        couponSelect.appendChild(option);
      });
    } catch (error) {
      console.error('載入優惠券失敗:', error);
    }
  }

  async function init() {
    const manager = await requireAuth();
    if (!manager) return;

    try {
      const vipData = await api("/vips");
      fillVipOptions(vipData.vips || []);
      await loadUsers();
      await loadCoupons();
    } catch (error) {
      summary.textContent = error.message;
      document.getElementById("message-rows").innerHTML =
        '<tr><td colspan="5" class="empty">無法載入會員</td></tr>';
    }
  }

  init();
})();
