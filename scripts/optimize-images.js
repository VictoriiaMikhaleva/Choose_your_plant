/**
 * Импорт и оптимизация фото из папки «единый стиль» → assets/plants/{id}.webp
 *
 * npm run optimize:images
 * npm run optimize:images -- --source "C:\path\to\folder"
 * npm run optimize:images -- --ids 1,2,3
 */
const fs = require("fs");
const path = require("path");
const { normalizeToWhiteCanvas } = require("./photo-normalize-lib");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");
const DEFAULT_SOURCE = path.join(
  "C:",
  "Users",
  "vitya",
  "Desktop",
  "Промптинг",
  "Вайб кодинг",
  "Картинки единый стиль",
  "1-100"
);

function loadPlants(html) {
  const m = html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("RAW_PLANTS not found");
  return { plants: JSON.parse(m[1]), marker: m[0] };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { source: DEFAULT_SOURCE, ids: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source") opts.source = args[++i];
    else if (args[i] === "--ids") opts.ids = new Set(String(args[++i]).split(",").map(Number));
    else if (args[i] === "--dry-run") opts.dryRun = true;
  }
  return opts;
}

function fileToId(filename) {
  const base = filename.toLowerCase();
  if (base.includes("anthurium_andraeanum")) return 5;
  if (base.includes("робуста") || base.includes("robusta")) return 68;
  const m =
    base.match(/_(\d{1,3})(?:\.(?:webp|png|jpe?g))+$/i) ||
    base.match(/_(\d{1,3})\.(webp|png|jpe?g)/i);
  return m ? Number(m[1]) : null;
}

function indexSourceFiles(sourceDir) {
  const map = new Map();
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Папка не найдена: ${sourceDir}`);
  }
  for (const name of fs.readdirSync(sourceDir)) {
    const id = fileToId(name);
    if (!id) continue;
    const prev = map.get(id);
    if (prev) {
      console.warn(`Дубликат id ${id}: ${prev} и ${name} — берём ${name}`);
    }
    map.set(id, path.join(sourceDir, name));
  }
  return map;
}

async function main() {
  const opts = parseArgs();
  const sourceMap = indexSourceFiles(opts.source);
  const html = fs.readFileSync(CATALOG, "utf8");
  const { plants, marker } = loadPlants(html);

  let targets;
  if (opts.ids) {
    targets = plants.filter((p) => opts.ids.has(p.id));
  } else {
    targets = plants.filter((p) => sourceMap.has(p.id));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let done = 0;
  let missed = 0;

  for (const plant of targets) {
    const src = sourceMap.get(plant.id);
    if (!src) {
      console.warn(`Нет файла для id ${plant.id} (${plant.nameRu})`);
      missed++;
      continue;
    }
    if (opts.dryRun) {
      console.log(`[dry-run] ${plant.id} ← ${path.basename(src)}`);
      done++;
      continue;
    }
    const buf = fs.readFileSync(src);
    const outPath = path.join(OUT_DIR, `${plant.id}.webp`);
    const srcMeta = await require("sharp")(buf).metadata();
    const alreadyStyled =
      /\.webp$/i.test(src) &&
      srcMeta.width >= 768 &&
      srcMeta.height >= 768;
    if (alreadyStyled) {
      await require("sharp")(buf).webp({ quality: 82, effort: 4 }).toFile(outPath);
    } else {
      await (await normalizeToWhiteCanvas(buf)).toFile(outPath);
    }
    plant.photo = `assets/plants/${plant.id}.webp`;
    console.log(`✓ ${plant.id} ${plant.nameRu}`);
    done++;
  }

  if (!opts.dryRun && done > 0) {
    const newMarker = "const RAW_PLANTS = " + JSON.stringify(plants) + ";";
    fs.writeFileSync(CATALOG, html.replace(marker, newMarker));
  }

  console.log(`\nГотово: ${done} фото → ${OUT_DIR}`);
  if (missed) console.log(`Без источника: ${missed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
