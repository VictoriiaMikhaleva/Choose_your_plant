/**
 * Клиентский PDF через window.print() — изолированный модуль.
 * Ожидает bind() из каталога с getResults / getFilters.
 */
(function () {
  "use strict";

  const PROFILE_LABELS = {
    darkOffice: "Тёмный офис",
    livingRoom: "Гостиная / интерьер",
    sunnyWindow: "Солнечное окно",
    bathroom: "Влажная ванная",
    restaurant: "Коммерческий объект",
    pets: "Дом с питомцами",
    largePlant: "Крупное растение",
    custom: null,
  };

  const PETS_LABELS = {
    any: "Не важно",
    safe: "Нужны безопасные для питомцев",
    no: "Питомцев нет",
  };

  let getResults = () => [];
  let getFilters = () => ({});
  let getProfileKey = () => "custom";
  let photoCacheV = "";

  function esc(s) {
    return String(s ?? "").replace(/[&<>'"]/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[m]
    );
  }

  function photoSrc(photo) {
    if (!photo) return "";
    const base = String(photo).split("?")[0];
    return `${base}?v=${photoCacheV || "1"}`;
  }

  function formatDateRu() {
    return new Date().toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatNumber(n) {
    return Number(n).toLocaleString("ru-RU");
  }

  function buildSummaryText(total, topPlants) {
    if (!total) return "По заданным условиям подходящих растений не найдено.";
    const scores = topPlants.map((p) => p.score);
    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const range = min === max ? `${max} баллов` : `${min}–${max} баллов`;
    const noun =
      total % 10 === 1 && total % 100 !== 11
        ? "растение"
        : total % 10 >= 2 && total % 10 <= 4 && (total % 100 < 10 || total % 100 >= 20)
          ? "растения"
          : "растений";
    return `По заданным условиям найдено ${total} подходящ${noun === "растение" ? "ее" : "их"} ${noun}. Лучшие варианты в подборке имеют совместимость ${range}.`;
  }

  function buildWhyText(plant) {
    const parts = [];
    if (plant.reasons?.length) {
      const nice = plant.reasons
        .filter((r) => !/опасно для питомцев/i.test(r))
        .slice(0, 3)
        .map((r) => r.replace(/^./, (c) => c.toUpperCase()));
      if (nice.length) parts.push(nice.join(". ") + ".");
    }
    if (!parts.length && plant.comments) {
      const snippet = String(plant.comments).split(/[.!]/)[0];
      if (snippet) parts.push(snippet.trim() + ".");
    }
    return (
      parts.join(" ") ||
      "Условия помещения близки к рекомендуемым для этого вида — наблюдайте адаптацию 2–3 недели."
    );
  }

  function buildRecommendations(filters, plants) {
    const recs = new Set();
    const tips = plants.flatMap((p) => p.tips || []).slice(0, 6);
    tips.forEach((t) => recs.add(t));

    if (filters.light < 1500) {
      recs.add("Разместите растения ближе к источнику света или добавьте фитолампу.");
    } else if (filters.light > 8000) {
      recs.add("При ярком солнце используйте лёгкое рассеивание — тюль или штору.");
    }

    if (filters.humidity < 45) {
      recs.add("При сухом воздухе сгруппируйте растения или используйте увлажнитель.");
    }

    if (filters.temp > 26) {
      recs.add("Не ставьте горшки вплотную к батарее и горячим поверхностям.");
    }

    if (filters.pets === "safe") {
      recs.add("Даже pet-friendly виды лучше держать вне досягаемости любопытных питомцев.");
    }

    recs.add("Поворачивайте растение на 90° раз в 1–2 недели для равномерного роста.");
    recs.add("Используйте дренажный слой и не оставляйте воду в поддоне после полива.");

    return [...recs].slice(0, 6);
  }

  function renderParamCard(icon, label, value) {
    return `<div class="pdf-param-card">
      <span class="pdf-param-card__icon" aria-hidden="true">${icon}</span>
      <span class="pdf-param-card__label">${esc(label)}</span>
      <span class="pdf-param-card__value">${esc(value)}</span>
    </div>`;
  }

  function renderPlantCard(plant) {
    const petLine = plant.petSafe
      ? "🐾 Pet-friendly"
      : "🐾 Опасно для питомцев";
    const img = plant.photo
      ? `<img src="${esc(photoSrc(plant.photo))}" alt="">`
      : `<span aria-hidden="true">🌿</span>`;

    return `<article class="pdf-plant-card">
      <div class="pdf-plant-photo">${img}</div>
      <div class="pdf-plant-body">
        <div class="pdf-plant-head">
          <div class="pdf-plant-names">
            <h3>${esc(plant.nameRu)}</h3>
            <p>${esc(plant.nameLat)}</p>
          </div>
          <div class="pdf-score-badge">${plant.score}/100</div>
        </div>
        <div class="pdf-plant-metrics">
          <div class="pdf-metric"><strong>☀ Свет</strong> ${esc(plant.light)} лк</div>
          <div class="pdf-metric"><strong>💧 Влажность</strong> ${esc(plant.humidity)}%</div>
          <div class="pdf-metric"><strong>🌡 Температура</strong> ${esc(plant.temp)} °C</div>
          <div class="pdf-metric"><strong>🪴 Полив</strong> ${esc(plant.watering)}</div>
          <div class="pdf-metric"><strong>${esc(petLine)}</strong></div>
        </div>
        <p class="pdf-why">
          <span class="pdf-why-label">Почему подходит</span>
          ${esc(buildWhyText(plant))}
        </p>
      </div>
    </article>`;
  }

  function fillTemplate() {
    const results = getResults();
    const f = getFilters();
    const profileKey = getProfileKey();
    const top = results.slice(0, 8);
    const profileLabel = PROFILE_LABELS[profileKey];

    const paramCards = [
      renderParamCard("☀", "Освещённость", `${formatNumber(f.light)} лк`),
      renderParamCard("💧", "Влажность", `${f.humidity}%`),
      renderParamCard("🌡", "Температура", `${f.temp} °C`),
      renderParamCard("🐾", "Домашние животные", PETS_LABELS[f.pets] || f.pets),
    ];

    if (profileLabel) {
      paramCards.push(renderParamCard("🪴", "Тип помещения", profileLabel));
    }

    const root = document.getElementById("pdf-template");
    if (!root) return;

    root.querySelector(".pdf-cover-date").textContent = formatDateRu();
    root.querySelector(".pdf-params-grid").innerHTML = paramCards.join("");
    root.querySelector(".pdf-summary-box p").textContent = buildSummaryText(
      results.length,
      top.length ? top : results
    );

    const plantsEl = root.querySelector(".pdf-plants-list");
    plantsEl.innerHTML = top.length
      ? top.map(renderPlantCard).join("")
      : `<p class="pdf-section-lead">Нет растений для экспорта — измените параметры подбора.</p>`;

    const recs = buildRecommendations(f, top);
    root.querySelector(".pdf-recs ul").innerHTML = recs
      .map((r) => `<li>${esc(r)}</li>`)
      .join("");
  }

  function preloadPdfImages() {
    const imgs = document.querySelectorAll("#pdf-template img");
    return Promise.all(
      [...imgs].map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = resolve;
              img.onerror = resolve;
            }
          })
      )
    );
  }

  async function prepareAndPrint() {
    const results = getResults();
    if (!results.length) {
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "Сначала подберите растения — список пуст";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 2200);
      } else {
        alert("Сначала подберите растения — список пуст.");
      }
      return;
    }

    fillTemplate();
    await preloadPdfImages();

    const cleanup = () => {
      document.body.classList.remove("is-printing-pdf");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("is-printing-pdf");
    window.print();
  }

  function bind(opts) {
    if (opts.getResults) getResults = opts.getResults;
    if (opts.getFilters) getFilters = opts.getFilters;
    if (opts.getProfileKey) getProfileKey = opts.getProfileKey;
    if (opts.photoCacheV) photoCacheV = opts.photoCacheV;

    const btn = document.getElementById("pdfPrintBtn");
    if (btn) {
      btn.addEventListener("click", prepareAndPrint);
    }
  }

  window.PlantFitPdf = { bind, fillTemplate, prepareAndPrint };
})();
