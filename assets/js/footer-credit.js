(() => {
  const CREDIT_TEXT = "Создано Викторией Михалевой";
  const CREDIT_DESC = "контент, ИИ и цифровые проекты";
  const CREDIT_URL = "https://www.content-system.ru/";

  function ensureStyles() {
    if (document.getElementById("footerCreditStyles")) return;

    const style = document.createElement("style");
    style.id = "footerCreditStyles";
    style.textContent = `
      .footer-credit {
        margin-top: 0.65rem;
        padding-top: 0.65rem;
        border-top: 1px solid rgba(23, 32, 24, 0.12);
        text-align: center;
        font-size: 0.75rem;
        line-height: 1.45;
      }
      .footer-credit__line {
        margin: 0;
      }
      .footer-credit__link {
        color: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .footer-credit__link:hover {
        opacity: 0.8;
      }
    `;
    document.head.appendChild(style);
  }

  function renderCredit(host) {
    const baseText = host.getAttribute("data-footer-base");
    const baseHtml = baseText
      ? `<p class="footer-credit__line">${baseText}</p>`
      : "";

    host.innerHTML = `
      ${baseHtml}
      <div class="footer-credit">
        <p class="footer-credit__line">
          ${CREDIT_TEXT} · ${CREDIT_DESC} ·
          <a class="footer-credit__link" href="${CREDIT_URL}" target="_blank" rel="noopener noreferrer">content-system.ru</a>
        </p>
      </div>
    `;
  }

  function initFooterCredit() {
    const hosts = document.querySelectorAll("[data-footer-credit-host]");
    if (!hosts.length) return;
    ensureStyles();
    hosts.forEach(renderCredit);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFooterCredit, { once: true });
  } else {
    initFooterCredit();
  }
})();
