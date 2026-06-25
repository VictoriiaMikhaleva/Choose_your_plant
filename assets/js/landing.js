const CATALOG_URL = "plant_selector_catalog_v6_photos_lux_fixed.html";
const quickStartForm = document.getElementById("quickStartForm");
const scenarioStatus = document.getElementById("scenarioStatus");
const scenarioCards = document.querySelectorAll(".onboarding-card[data-profile]");

const SCENARIO_LABELS = {
  dark: "Тёмная квартира",
  pets: "Дом с питомцами",
  sun: "Солнечное окно",
  easy: "Неприхотливые растения",
  office: "Для офиса",
  large: "Большое растение в интерьер",
};

function openCatalogWithProfile(profile) {
  if (!profile) {
    window.location.href = CATALOG_URL;
    return;
  }

  localStorage.setItem("plantfit.quickProfile", profile);
  const url = new URL(CATALOG_URL, window.location.href);
  url.searchParams.set("profile", profile);
  window.location.href = url.toString();
}

function setScenarioStatus(message) {
  if (scenarioStatus) {
    scenarioStatus.textContent = message;
  }
}

function handleScenarioSelect(card) {
  const profile = card.dataset.profile;
  const scenario = card.dataset.scenario;
  const label = SCENARIO_LABELS[scenario] || card.querySelector(".onboarding-card__headline")?.textContent;

  if (!profile) {
    return;
  }

  scenarioCards.forEach((item) => {
    item.classList.toggle("is-selected", item === card);
    item.classList.toggle("is-loading", item === card);
    item.setAttribute("aria-pressed", item === card ? "true" : "false");
  });

  setScenarioStatus(label ? `Открываем каталог: ${label}…` : "Открываем каталог…");

  const hiddenProfile = document.getElementById("profile");
  if (hiddenProfile) {
    hiddenProfile.value = profile;
  }

  window.setTimeout(() => openCatalogWithProfile(profile), 120);
}

scenarioCards.forEach((card) => {
  card.setAttribute("aria-pressed", "false");
  card.addEventListener("click", () => handleScenarioSelect(card));
});

if (quickStartForm) {
  quickStartForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(quickStartForm);
    openCatalogWithProfile(formData.get("profile"));
  });
}

function initMagnetStepCards() {
  const canAnimate =
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (!canAnimate) {
    return;
  }

  const strength = 0.16;
  const lift = -7;

  document.querySelectorAll(".how-step-card").forEach((card) => {
    const img = card.querySelector(".how-step-card__img");
    if (!img) {
      return;
    }

    card.addEventListener("mousemove", (event) => {
      const rect = card.getBoundingClientRect();
      const offsetX = event.clientX - rect.left - rect.width / 2;
      const offsetY = event.clientY - rect.top - rect.height / 2;
      const moveX = offsetX * strength;
      const moveY = offsetY * strength + lift;

      img.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.035)`;
      card.classList.add("is-magnet");
    });

    const resetCard = () => {
      img.style.transform = "";
      card.classList.remove("is-magnet");
    };

    card.addEventListener("mouseleave", resetCard);
  });
}

initMagnetStepCards();
