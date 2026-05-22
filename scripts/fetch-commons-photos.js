/**
 * Подбор фото с Wikimedia Commons (открытые лицензии) + нормализация.
 *
 * node scripts/fetch-commons-photos.js           # все, кроме 101–105
 * node scripts/fetch-commons-photos.js --limit 5
 * node scripts/fetch-commons-photos.js --ids 1,2,3
 * node scripts/fetch-commons-photos.js --dry-run
 */
const fs = require("fs");
const path = require("path");
const { normalizeToWhiteCanvas } = require("./photo-normalize-lib");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");
const ATTR_PATH = path.join(OUT_DIR, "attribution.json");
const API = "https://commons.wikimedia.org/w/api.php";
const SKIP_IDS = new Set([101, 102, 103, 104, 105]);
const DELAY_MS = 900;
const DOWNLOAD_RETRIES = 4;

const BAD_TITLE = /icon|logo|map|chart|diagram|illustration|stamp|coin|herbarium|seed|flower\s+only|cross.?section|anatomy|svg/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function latinQuery(nameLat) {
  const clean = String(nameLat || "")
    .replace(/['"]/g, "")
    .replace(/\s+cv\.?\s*.*/i, "")
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || clean;
}

function isAllowedLicense(ii) {
  const em = ii.extmetadata || {};
  const short = String(em.LicenseShortName?.value || em.License?.value || "").toLowerCase();
  const url = String(em.LicenseUrl?.value || "").toLowerCase();
  if (short.includes("public domain") || url.includes("publicdomain")) return true;
  if (
    short.includes("cc-by") ||
    short.includes("cc by") ||
    short.includes("cc-by-sa") ||
    url.includes("creativecommons.org")
  )
    return true;
  return false;
}

function scoreCandidate(page, ii) {
  if (!ii?.url || !ii.width || !ii.height) return -1;
  if (!isAllowedLicense(ii)) return -1;
  if (BAD_TITLE.test(page.title)) return -1;
  const mime = String(ii.mime || "");
  if (!/^image\/(jpeg|png|webp|gif)/i.test(mime)) return -1;
  if (ii.width < 500 || ii.height < 500) return -1;

  let score = Math.min(ii.width, ii.height);
  const ar = ii.width / ii.height;
  if (ar >= 0.45 && ar <= 2.2) score += 400;
  const t = page.title.toLowerCase();
  if (/plant|houseplant|indoor|pot|garden|leaves|foliage/.test(t)) score += 300;
  if (/flower|bloom|inflorescence/.test(t) && !/plant|leaves|foliage/.test(t)) score -= 200;
  return score;
}

async function commonsSearch(query) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: query,
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "1400",
  });
  const res = await fetch(`${API}?${params}`);
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  const data = await res.json();
  const pages = data.query?.pages || {};
  let best = null;
  let bestScore = -1;
  for (const page of Object.values(pages)) {
    const ii = page.imageinfo?.[0];
    const s = scoreCandidate(page, ii);
    if (s > bestScore) {
      bestScore = s;
      best = { page, ii, score: s };
    }
  }
  return best;
}

async function downloadImage(url) {
  const headers = {
    "User-Agent": "PlantFitPro/1.0 (educational plant catalog; contact: local-dev)",
  };
  let lastErr;
  for (let attempt = 0; attempt < DOWNLOAD_RETRIES; attempt++) {
    if (attempt) await sleep(2000 * attempt);
    const res = await fetch(url, { headers });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    lastErr = new Error(`Download ${res.status}`);
    if (res.status !== 429) throw lastErr;
  }
  throw lastErr;
}

function loadPlants() {
  const html = fs.readFileSync(CATALOG, "utf8");
  const m = html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/);
  return JSON.parse(m[1]);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, limit: 0, ids: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--limit") opts.limit = Number(args[++i]) || 0;
    else if (args[i] === "--ids") opts.ids = new Set(String(args[++i]).split(",").map(Number));
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let plants = loadPlants().filter((p) => !SKIP_IDS.has(p.id));
  if (opts.ids) plants = plants.filter((p) => opts.ids.has(p.id));
  if (opts.limit > 0) plants = plants.slice(0, opts.limit);

  let attr = {};
  if (fs.existsSync(ATTR_PATH)) {
    try {
      attr = JSON.parse(fs.readFileSync(ATTR_PATH, "utf8"));
    } catch {
      attr = {};
    }
  }

  let ok = 0;
  let fail = 0;

  for (const plant of plants) {
    const q = `${latinQuery(plant.nameLat)} plant`;
    process.stdout.write(`${plant.id} ${plant.nameRu}… `);
    await sleep(DELAY_MS);

    try {
      const hit = await commonsSearch(q);
      if (!hit) {
        console.log("не найдено");
        fail++;
        continue;
      }
      const { page, ii } = hit;
      const license =
        ii.extmetadata?.LicenseShortName?.value ||
        ii.extmetadata?.License?.value ||
        "CC / открытая лицензия";
      const artist = ii.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") || "";

      if (opts.dryRun) {
        console.log(`→ ${page.title.slice(0, 50)}…`);
        ok++;
        continue;
      }

      const imgUrl = ii.thumburl || ii.url;
      await sleep(400);
      const buf = await downloadImage(imgUrl);
      const outPath = path.join(OUT_DIR, `${plant.id}.webp`);
      await (await normalizeToWhiteCanvas(buf)).toFile(outPath);

      attr[String(plant.id)] = {
        file: page.title,
        sourceUrl: ii.descriptionurl || ii.url,
        imageUrl: ii.url,
        license: license.replace(/\s+/g, " ").trim(),
        artist: artist.replace(/\s+/g, " ").trim().slice(0, 200),
        credit: `Wikimedia Commons — ${page.title}`,
      };
      console.log("ok");
      ok++;
    } catch (e) {
      console.log("ошибка:", e.message);
      fail++;
    }
  }

  if (!opts.dryRun) {
    fs.writeFileSync(ATTR_PATH, JSON.stringify(attr, null, 2), "utf8");
  }
  console.log(`\nГотово: ${ok} успешно, ${fail} без фото`);
  if (!opts.dryRun) console.log(`Атрибуция: ${ATTR_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
