/**
 * Пересобирает все webp из оригиналов (git до нормализации) или JPG/текущих файлов.
 * node scripts/renormalize-all-photos.js
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { normalizeToWhiteCanvas } = require("./photo-normalize-lib");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");
const GIT_ORIGINAL = "7438355:plant_selector_catalog_v6_photos_lux_fixed.html";

const EXTRA_JPG = {
  101: "Банан комнатный.JPG",
  102: "Крестовник роули.JPG",
  103: "Кодиеум.JPG",
  104: "Седум буритто.JPG",
  105: "Сенполия.JPG",
};

function loadPlants(html) {
  const m = html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("RAW_PLANTS not found");
  return JSON.parse(m[1]);
}

function loadGitOriginals() {
  try {
    const oldHtml = execSync(`git show ${GIT_ORIGINAL}`, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const map = new Map();
    for (const p of loadPlants(oldHtml)) {
      if (p.photo && String(p.photo).startsWith("data:image")) {
        map.set(p.id, Buffer.from(p.photo.replace(/^data:image\/\w+;base64,/, ""), "base64"));
      }
    }
    console.log(`Оригиналы из git: ${map.size} фото`);
    return map;
  } catch (e) {
    console.warn("Git-оригиналы недоступны:", e.message);
    return new Map();
  }
}

async function sourceBuffer(plant, gitOriginals) {
  const id = plant.id;
  if (gitOriginals.has(id)) return gitOriginals.get(id);
  const jpg = EXTRA_JPG[id];
  if (jpg) {
    const p = path.join(ROOT, jpg);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  const webp = path.join(OUT_DIR, `${id}.webp`);
  if (fs.existsSync(webp)) return fs.readFileSync(webp);
  if (plant.photo && plant.photo.startsWith("data:image")) {
    return Buffer.from(plant.photo.replace(/^data:image\/\w+;base64,/, ""), "base64");
  }
  const rel = path.join(ROOT, plant.photo || "");
  if (fs.existsSync(rel)) return fs.readFileSync(rel);
  return null;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const plants = loadPlants(fs.readFileSync(CATALOG, "utf8"));
  const gitOriginals = loadGitOriginals();
  let done = 0;
  let missed = 0;

  for (const plant of plants) {
    const buf = await sourceBuffer(plant, gitOriginals);
    if (!buf) {
      console.warn(`Нет источника: id ${plant.id} ${plant.nameRu}`);
      missed++;
      continue;
    }
    const outPath = path.join(OUT_DIR, `${plant.id}.webp`);
    const pipeline = await normalizeToWhiteCanvas(buf);
    await pipeline.toFile(outPath);
    plant.photo = `assets/plants/${plant.id}.webp`;
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${plants.length}…`);
  }

  console.log(`Готово: ${done} webp в ${OUT_DIR}`);
  if (missed) console.log(`Без источника: ${missed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
