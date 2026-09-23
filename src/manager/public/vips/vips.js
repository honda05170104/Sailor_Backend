(function () {
  const M = window.Manager;
  if (!M) return;

  const { api, escapeHtml, requireAuth } = M;
  const errorEl = document.getElementById("vip-rules-error");
  const vipRulesEl = document.getElementById("vip-rules");

  function formatMoney(value) {
    const amount = Number(value) || 0;
    return amount.toLocaleString("zh-TW");
  }

  function renderVipRules(vips) {
    if (!vips.length) {
      vipRulesEl.innerHTML = '<p class="muted">尚無 VIP 規則</p>';
      return;
    }

    vipRulesEl.innerHTML = vips
      .map((vip) => {
        const benefits = Array.isArray(vip.benefits) ? vip.benefits : [];
        const benefitHtml = benefits.length
          ? `<ul class="vip-benefits">${benefits
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
          : `<p class="muted">${escapeHtml(vip.description || "—")}</p>`;

        return `<article class="vip-rule-card">
          <div class="vip-rule-head">
            <h3>${escapeHtml(vip.name)}</h3>
            <span class="vip-rule-spend">門檻 $${formatMoney(vip.minSpend)}</span>
          </div>
          ${benefitHtml}
        </article>`;
      })
      .join("");
  }

  requireAuth().then((manager) => {
    if (!manager) return;
    api("/vips")
      .then((data) => {
        renderVipRules(data.vips || []);
      })
      .catch((error) => {
        errorEl.textContent = error.message || "讀取 VIP 規則失敗";
        vipRulesEl.innerHTML = "";
      });
  });
})();
