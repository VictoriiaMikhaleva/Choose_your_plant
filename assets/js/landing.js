const quickStartForm = document.getElementById("quickStartForm");
const showProfileFormButton = document.getElementById("showProfileForm");

function openCatalogWithProfile(profile) {
  if (!profile) {
    window.location.href = "plant_selector_catalog_v6_photos_lux_fixed.html";
    return;
  }

  localStorage.setItem("plantfit.quickProfile", profile);
  const url = new URL("plant_selector_catalog_v6_photos_lux_fixed.html", window.location.href);
  url.searchParams.set("profile", profile);
  window.location.href = url.toString();
}

if (showProfileFormButton) {
  showProfileFormButton.addEventListener("click", () => {
    const aboutSection = document.getElementById("about");
    if (aboutSection) {
      aboutSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const profileSelect = document.getElementById("profile");
    if (profileSelect) {
      profileSelect.focus();
    }
  });
}

if (quickStartForm) {
  quickStartForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(quickStartForm);
    const profile = formData.get("profile");
    openCatalogWithProfile(profile);
  });
}
