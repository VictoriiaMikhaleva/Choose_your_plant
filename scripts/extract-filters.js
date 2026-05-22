const fs = require("fs");
const h = fs.readFileSync(
  require("path").join(__dirname, "../plant_selector_catalog_v6_photos_lux_fixed.html"),
  "utf8"
);
const i = h.indexOf('<aside class="panel filters">');
const j = h.indexOf("</aside>", i);
console.log(h.slice(i, j + 8));
