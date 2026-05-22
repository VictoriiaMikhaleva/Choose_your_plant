/**
 * Восстановить одно фото из git-оригинала каталога.
 * node scripts/restore-plant-photo.js 8
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { normalizeToWhiteCanvas } = require("./photo-normalize-lib");

const id = Number(process.argv[2]);
if (!id) {
  console.error("Укажите id: node scripts/restore-plant-photo.js 8");
  process.exit(1);
}

const ROOT = path.join(__dirname, "..");
const GIT = "7438355:plant_selector_catalog_v6_photos_lux_fixed.html";
const OUT = path.join(ROOT, "assets", "plants", `${id}.webp`);
const ATTR = path.join(ROOT, "assets", "plants", "attribution.json");

const html = execSync(`git show ${GIT}`, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const plant = JSON.parse(html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/)[1]).find((p) => p.id === id);
if (!plant?.photo?.startsWith("data:image")) {
  console.error("Оригинал не найден для id", id);
  process.exit(1);
}

const buf = Buffer.from(plant.photo.replace(/^data:image\/\w+;base64,/, ""), "base64");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
normalizeToWhiteCanvas(buf).then((p) => p.toFile(OUT)).then(() => {
  console.log("Восстановлено:", OUT, "—", plant.nameRu);
  if (fs.existsSync(ATTR)) {
    const attr = JSON.parse(fs.readFileSync(ATTR, "utf8"));
    delete attr[String(id)];
    fs.writeFileSync(ATTR, JSON.stringify(attr, null, 2) + "\n");
  }
});
