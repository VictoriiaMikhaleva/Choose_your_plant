/**
 * Нормализует 5 доп. JPG и добавляет карточки в RAW_PLANTS.
 * node scripts/add-extra-plants.js
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const CATALOG = path.join(ROOT, "plant_selector_catalog_v6_photos_lux_fixed.html");
const OUT_DIR = path.join(ROOT, "assets", "plants");
const CANVAS_W = 800;
const CANVAS_H = 600;

const EXTRA = [
  {
    file: "Банан комнатный.JPG",
    id: 101,
    nameRu: "Банан комнатный",
    nameLat: "Musa acuminata 'Dwarf Cavendish'",
    family: "Банановые",
    category: "Декоративно-лиственное, Крупномеры",
    origin: "Юго-Восточная Азия",
    temp: "20–28",
    light: "6000–12000",
    humidity: "55–75",
    watering: "на 1/4 горшка",
    soil: "Универсальный с добавлением большего количества влагоевких разрыхлителей",
    ph: "5.5–7.0",
    petDanger: "Нет",
    comments:
      "Компактный декоративный банан с крупными листьями; молодая листва часто с красноватыми пятнами. Нужны яркий свет, тепло и повышенная влажность. Субстрат держите равномерно влажным, без застоя воды; не ставьте в сквозняк и холод ниже 15 °C.",
  },
  {
    file: "Крестовник роули.JPG",
    id: 102,
    nameRu: "Крестовник Роули",
    nameLat: "Curio rowleyanus",
    family: "Астровые",
    category: "Суккуленты, Лианы",
    origin: "Юго-Западная Африка",
    temp: "18–24",
    light: "3500–7000",
    humidity: "30–50",
    watering: "Полностью",
    soil: "Для суккулентов",
    ph: "6.0–6.5",
    petDanger: "Да",
    comments:
      "Ампельный суккулент с круглыми листьями «бусинами» на тонких побегах. Любит яркий рассеянный свет и сухой воздух. Полив редкий — только после полного просыхания грунта; от избытка влаги быстро гниёт.",
  },
  {
    file: "Кодиеум.JPG",
    id: 103,
    nameRu: "Кодиеум пестролистный",
    nameLat: "Codiaeum variegatum",
    family: "Молочайные",
    category: "Декоративно-лиственное",
    origin: "Тропическая Азия, Малайский архипелаг",
    temp: "20–26",
    light: "4000–9000",
    humidity: "60–80",
    watering: "на 1/2 горшка",
    soil: "Универсальный",
    ph: "5.5–6.5",
    petDanger: "Да",
    comments:
      "Яркая пёстрая листва с жёлтыми и красными вкраплениями. Требует высокой освещённости и влажности; при недостатке света теряет окраску. Чувствителен к переохлаждению и сквознякам; сок раздражает кожу и опасен для питомцев.",
  },
  {
    file: "Седум буритто.JPG",
    id: 104,
    nameRu: "Седум «Буррито»",
    nameLat: "Sedum morganianum 'Burrito'",
    family: "Толстянковые",
    category: "Суккуленты, Лианы",
    origin: "Мексика",
    temp: "18–26",
    light: "3500–8000",
    humidity: "30–50",
    watering: "Полностью",
    soil: "Для суккулентов",
    ph: "6.0–7.0",
    petDanger: "Да",
    comments:
      "Ампельный суккулент с плотными мясистыми листьями на свисающих побегах. Предпочитает яркий свет и редкий обильный полив после просушки. Легко размножается листьями и черенками; не любит застой влаги в горшке.",
  },
  {
    file: "Сенполия.JPG",
    id: 105,
    nameRu: "Сенполия",
    nameLat: "Saintpaulia ionantha",
    family: "Геснериевые",
    category: "Цветущие",
    origin: "Восточная Африка (Танзания, Кения)",
    temp: "18–24",
    light: "1500–3500",
    humidity: "50–65",
    watering: "на 1/2 горшка",
    soil: "Универсальный",
    ph: "6.0–6.5",
    petDanger: "Нет",
    comments:
      "Компактное цветущее растение с бархатистыми листьями и длительным цветением при рассеянном свете. Полив тёплой отстоянной водой в поддон; не мочите розетку и не ставьте на прямое солнце — листья получают ожоги.",
  },
];

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
    .webp({ quality: 82, effort: 4 });
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
  const ids = new Set(plants.map((p) => p.id));

  for (const item of EXTRA) {
    if (ids.has(item.id)) {
      console.warn(`Пропуск id ${item.id} — уже есть`);
      continue;
    }
    const srcPath = path.join(ROOT, item.file);
    if (!fs.existsSync(srcPath)) {
      throw new Error(`Файл не найден: ${srcPath}`);
    }
    const buf = fs.readFileSync(srcPath);
    const outPath = path.join(OUT_DIR, `${item.id}.webp`);
    const pipeline = await normalizeToWhiteCanvas(buf);
    await pipeline.toFile(outPath);
    const { file, ...record } = item;
    record.photo = `assets/plants/${item.id}.webp`;
    plants.push(record);
    console.log(`+ ${item.id} ${item.nameRu} ← ${item.file}`);
  }

  const newMarker = "const RAW_PLANTS = " + JSON.stringify(plants) + ";";
  fs.writeFileSync(CATALOG, html.replace(marker, newMarker));
  console.log(`Каталог: ${plants.length} растений`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
