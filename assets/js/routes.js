/* Маршруты продукта «Подбор растений».
   Сейчас страницы лежат на GitHub Pages. После переноса на один домен
   достаточно заменить адреса в этом файле (и в таком же файле соседних репозиториев):
   home → /, indoor → /indoor/, garden → /garden/, trainer → /trainer/. */
(function () {
  var routes = {
    home: "https://victoriiamikhaleva.github.io/Choose_your_plant/",
    indoor: "https://victoriiamikhaleva.github.io/Choose_your_plant/plant_selector_catalog_v6_photos_lux_fixed.html",
    garden: "https://victoriiamikhaleva.github.io/garden_plants/garden_catalog.html",
    trainer: "https://victoriiamikhaleva.github.io/Fitodesigner/"
  };
  window.PLANT_ROUTES = routes;
  document.querySelectorAll("[data-route]").forEach(function (el) {
    var url = routes[el.getAttribute("data-route")];
    if (url) el.setAttribute("href", url);
  });
})();
