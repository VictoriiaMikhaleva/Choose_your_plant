/**
 * Нормализует фото из data URI в каталоге → assets/plants/{id}.webp
 * Запуск: node scripts/normalize-plant-photos.js
 */
const fs = require("fs");
const path = require("path");
const { normalizeToWhiteCanvas } = require("./photo-normalize-lib");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");

function loadPlants(html) {
  const m = html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("RAW_PLANTS not found");
  return { plants: JSON.parse(m[1]), marker: m[0] };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const html = fs.readFileSync(CATALOG, "utf8");
  const { plants, marker } = loadPlants(html);
  let done = 0;
  let skipped = 0;

  for (const plant of plants) {
    const src = plant.photo;
    if (!src || !String(src).startsWith("data:image")) {
      skipped++;
      continue;
    }
    const buf = Buffer.from(src.replace(/^data:image\/\w+;base64,/, ""), "base64");
    const outPath = path.join(OUT_DIR, `${plant.id}.webp`);
    await (await normalizeToWhiteCanvas(buf)).toFile(outPath);
    plant.photo = `assets/plants/${plant.id}.webp`;
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${plants.length}…`);
  }

  const newMarker = "const RAW_PLANTS = " + JSON.stringify(plants) + ";";
  fs.writeFileSync(CATALOG, html.replace(marker, newMarker));
  console.log(`Готово: ${done} фото → ${OUT_DIR}`);
  if (skipped) console.log(`Пропущено (не data URI): ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
