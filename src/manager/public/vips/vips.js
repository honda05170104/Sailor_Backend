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
        const rules = Array.isArray(vip.rules) ? vip.rules : [];
        const benefits = Array.isArray(vip.benefits) ? vip.benefits : [];
        const ruleHtml = rules.length
          ? `<p class="vip-rule-label">升降規則</p><ul class="vip-rule-lines">${rules
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
          : "";
        const benefitHtml = benefits.length
          ? `<p class="vip-rule-label">會員權益</p><ul class="vip-benefits">${benefits
              .map((item) => `<li>${escapeHtml(item)}</li>`)
              .join("")}</ul>`
          : rules.length
            ? ""
            : `<p class="muted">${escapeHtml(vip.description || "—")}</p>`;

        const retain = Number(vip.retainSpend) || 0;
        const spendLabel =
          retain > 0
            ? `升等 $${formatMoney(vip.minSpend)} · 保留 $${formatMoney(retain)}`
            : `門檻 $${formatMoney(vip.minSpend)}`;

        return `<article class="vip-rule-card">
          <div class="vip-rule-head">
            <h3>${escapeHtml(vip.name)}</h3>
            <span class="vip-rule-spend">${spendLabel}</span>
          </div>
          ${ruleHtml}
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
