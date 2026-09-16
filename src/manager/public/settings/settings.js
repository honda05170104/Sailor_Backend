(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, requireAuth } = M;
  const form = document.getElementById("settings-form");
  const errorEl = document.getElementById("settings-error");

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

  requireAuth().then((manager) => {
    if (!manager) return;
    load().catch((error) => {
      errorEl.textContent = error.message || "讀取設定失敗";
    });
  });
})();
