/**
 * Нормализует фото растений: 4:3, белый фон, растение целиком (contain).
 * Сохраняет assets/plants/{id}.webp и подменяет data URI в каталоге на пути.
 *
 * Запуск: node scripts/normalize-plant-photos.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");
const CANVAS_W = 800;
const CANVAS_H = 600;
const WEBP_QUALITY = 82;

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яё\-]/gi, "")
    .slice(0, 80);
}

async function normalizeToWhiteCanvas(inputBuffer) {
  const base = sharp(inputBuffer).rotate().flatten({ background: "#ffffff" });
  const meta = await base.metadata();
  const w = meta.width || CANVAS_W;
  const h = meta.height || CANVAS_H;
  const scale = Math.min(CANVAS_W / w, CANVAS_H / h, 1);
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const padTop = Math.floor((CANVAS_H - nh) / 2);
  const padBottom = CANVAS_H - nh - padTop;
  const padLeft = Math.floor((CANVAS_W - nw) / 2);
  const padRight = CANVAS_W - nw - padLeft;

  return base
    .resize(nw, nh, { fit: "inside", withoutEnlargement: true })
    .extend({
      top: padTop,
      bottom: padBottom,
      left: padLeft,
      right: padRight,
      background: "#ffffff",
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 });
}

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
    const base64 = src.replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(base64, "base64");
    const outPath = path.join(OUT_DIR, `${plant.id}.webp`);
    const pipeline = await normalizeToWhiteCanvas(buf);
    await pipeline.toFile(outPath);
    plant.photo = `assets/plants/${plant.id}.webp`;
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${plants.length}…`);
  }

  const newMarker = "const RAW_PLANTS = " + JSON.stringify(plants) + ";";
  const newHtml = html.replace(marker, newMarker);
  fs.writeFileSync(CATALOG, newHtml);

  console.log(`Готово: ${done} фото → ${OUT_DIR}`);
  if (skipped) console.log(`Пропущено (не data URI): ${skipped}`);
  console.log(`Каталог обновлён: ${CATALOG}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
