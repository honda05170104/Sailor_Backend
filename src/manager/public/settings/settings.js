(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, requireAuth } = M;
  const form = document.getElementById("settings-form");
  const errorEl = document.getElementById("settings-error");
  const vipSyncBtn = document.getElementById("vip-sync-btn");
  const vipSyncError = document.getElementById("vip-sync-error");
  const vipSyncResult = document.getElementById("vip-sync-result");
  const cashbackSyncBtn = document.getElementById("cashback-sync-btn");
  const cashbackSyncError = document.getElementById("cashback-sync-error");
  const cashbackSyncResult = document.getElementById("cashback-sync-result");

  function padTime(value) {
    const match = /^(\d{1,2}):(\d{2})/.exec(String(value || "").trim());
    if (!match) return "18:00";
    return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
  }

  function fill(config) {
    const times = config.times || {};
    const mouse = times.mouseOrder || {};
    document.getElementById("settings-timezone").value = times.timezone || "Asia/Taipei";
    document.getElementById("settings-deadline-weekday").value = String(
      mouse.deadlineWeekday ?? 2
    );
    document.getElementById("settings-deadline-time").value = padTime(mouse.deadlineTime);
    document.getElementById("settings-arrive-weekday").value = String(
      mouse.arriveWeekday ?? 4
    );
    document.getElementById("settings-arrive-offset").value = String(
      mouse.arriveOffsetWeeks ?? 0
    );
  }

  async function load() {
    const data = await api("/config");
    fill(data.config);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.textContent = "";
    try {
      const data = await api("/config", {
        method: "POST",
        body: JSON.stringify({
          times: {
            timezone: document.getElementById("settings-timezone").value.trim(),
            mouseOrder: {
              deadlineWeekday: Number(document.getElementById("settings-deadline-weekday").value),
              deadlineTime: padTime(document.getElementById("settings-deadline-time").value),
              arriveWeekday: Number(document.getElementById("settings-arrive-weekday").value),
              arriveOffsetWeeks: Number(document.getElementById("settings-arrive-offset").value),
            },
          },
        }),
        toast: "已儲存時間設定",
      });
      fill(data.config);
    } catch (error) {
      errorEl.textContent = error.message || "儲存失敗";
    }
  });

  vipSyncBtn.addEventListener("click", async () => {
    vipSyncError.textContent = "";
    vipSyncResult.textContent = "";
    vipSyncBtn.disabled = true;
    try {
      const data = await api("/vips/run-daily-sync", {
        method: "POST",
        toast: "VIP 升降級掃描完成",
      });
      const r = data.result || {};
      vipSyncResult.textContent = [
        `掃描 ${r.scanned ?? 0} 人`,
        `升等 ${r.upgraded ?? 0}`,
        `降級 ${r.downgraded ?? 0}`,
        `保級 ${r.protected ?? 0}`,
        `不變 ${r.unchanged ?? 0}`,
        `失敗 ${r.failed ?? 0}`,
      ].join("｜");
    } catch (error) {
      vipSyncError.textContent = error.message || "執行失敗";
    } finally {
      vipSyncBtn.disabled = false;
    }
  });

  cashbackSyncBtn.addEventListener("click", async () => {
    cashbackSyncError.textContent = "";
    cashbackSyncResult.textContent = "";
    cashbackSyncBtn.disabled = true;
    try {
      const data = await api("/vips/run-daily-cashback", {
        method: "POST",
        toast: "點數回饋掃描完成",
      });
      const r = data.result || {};
      cashbackSyncResult.textContent = [
        `待處理會員 ${r.scanned ?? 0}`,
        `已回饋 ${r.creditedUsers ?? 0} 人`,
        `略過 ${r.skippedUsers ?? 0}`,
        `合計 +${r.totalPoints ?? 0} 點`,
        `失敗 ${r.failed ?? 0}`,
      ].join("｜");
    } catch (error) {
      cashbackSyncError.textContent = error.message || "執行失敗";
    } finally {
      cashbackSyncBtn.disabled = false;
    }
  });

  requireAuth().then((manager) => {
    if (!manager) return;
    load().catch((error) => {
      errorEl.textContent = error.message || "讀取設定失敗";
    });
  });
})();
