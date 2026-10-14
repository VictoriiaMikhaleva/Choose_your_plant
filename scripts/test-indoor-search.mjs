import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const search = require(path.join(root, "assets/js/plant-search.js"));

const html = fs.readFileSync(path.join(root, "plant_selector_catalog_v6_photos_lux_fixed.html"), "utf8");
const match = html.match(/const RAW_PLANTS = (\[[\s\S]*?\]);/);
if (!match) throw new Error("RAW_PLANTS не найден");
const plants = JSON.parse(match[1]);

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

function idsOf(query) {
  return search.search(plants, query, search.INDOOR_ALIASES).map((plant) => plant.id);
}

function expectIds(query, expected) {
  const actual = idsOf(query);
  check(actual.length === new Set(actual).size, `"${query}": дубликаты`);
  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));
  check(!missing.length, `"${query}": нет ID ${missing.join(",")}; факт [${actual.join(",")}]`);
  check(!unexpected.length, `"${query}": лишние ID ${unexpected.join(",")}; факт [${actual.join(",")}]`);
}

function expectIncludes(query, expected) {
  const actual = idsOf(query);
  const missing = expected.filter((id) => !actual.includes(id));
  check(!missing.length, `"${query}": нет ожидаемых ID ${missing.join(",")}; факт [${actual.join(",")}]`);
}

function byGenus(genus) {
  return plants.filter((plant) => search.latinGenus(plant.nameLat) === genus).map((plant) => plant.id);
}

function significantTokens(plant) {
  return search.tokenize(`${plant.nameRu} ${plant.nameLat || ""}`).filter((token) => token.length >= 3);
}

check(plants.length === 147, `комнатных растений ${plants.length}, ожидалось 147`);
check(new Set(plants.map((plant) => plant.id)).size === 147, "ID комнатного каталога не уникальны");
check(html.includes("assets/js/plant-search.js"), "каталог не подключает plant-search.js");
check(html.includes("PlantSearch.matches(p,f.q,PlantSearch.INDOOR_ALIASES)"), "каталог не использует PlantSearch");
check(html.includes("openCatalog||!!f.q"), "поиск не показывает все найденные карточки");
check(html.includes("p.text"), "поле text для оценки ухода не должно пропасть");

expectIds("фикус", byGenus("ficus"));
expectIds("Ficus", byGenus("ficus"));
expectIds("монстера", byGenus("monstera"));
expectIds("Monstera", byGenus("monstera"));
expectIds("сансевиерия", byGenus("sansevieria"));
expectIds("щучий хвост", byGenus("sansevieria"));
expectIds("тещин язык", byGenus("sansevieria"));
expectIds("калатея", plants.filter((plant) => /^калатея\b/i.test(plant.nameRu) || ["goeppertia", "calathea"].includes(search.latinGenus(plant.nameLat))).map((plant) => plant.id));
expectIncludes("строманта", [128]);
expectIds("бегония", byGenus("begonia"));
expectIds("орхидея", [...byGenus("phalaenopsis"), ...byGenus("dendrobium")]);
expectIncludes("фаленопсис", [108]);
expectIncludes("дендробиум", [137]);
expectIds("алоэ", byGenus("aloe"));
expectIds("алое", byGenus("aloe"));
expectIds("литопс", byGenus("lithops"));
expectIncludes("живые камни", [147]);
expectIds("хлорофитум", byGenus("chlorophytum"));

for (const id of [128, 129, 130, 131, 137, 146, 147]) {
  const plant = plants.find((item) => item.id === id);
  check(plant, `нет новой карточки ${id}`);
  expectIncludes(plant.nameRu, [id]);
  if (plant.nameLat) expectIncludes(plant.nameLat, [id]);
}

expectIncludes("триостар", [128]);
expectIncludes("макоя", [130]);
expectIncludes("комнатная ель", [146]);
expectIncludes("норфолкская сосна", [146]);
expectIncludes("араукария", [146]);

check(!idsOf("орхидея").includes(143), "стрептокарпус не должен выдаваться по «орхидея»");
check(!idsOf("монстера").includes(42), "рафидофора не должна выдаваться по «монстера»");
expectIncludes("рафидофора", [42]);

for (const plant of plants) {
  const found = idsOf(plant.nameRu);
  check(found.includes(plant.id), `полное имя «${plant.nameRu}» не нашло id ${plant.id}; факт [${found.join(",")}]`);
  check(found.length === new Set(found).size, `полное имя «${plant.nameRu}»: дубликаты`);
  if (plant.nameLat) {
    const latinFound = idsOf(plant.nameLat);
    check(latinFound.includes(plant.id), `латынь «${plant.nameLat}» не нашла id ${plant.id}`);
  }
  for (const token of significantTokens(plant)) {
    const partFound = idsOf(token);
    check(partFound.includes(plant.id), `часть «${token}» не нашла id ${plant.id} (${plant.nameRu})`);
  }
}

check(idsOf("").length === 147, "пустой запрос должен возвращать весь каталог");
expectIncludes("женское счастье", byGenus("spathiphyllum"));
expectIncludes("долларовое дерево", byGenus("zamioculcas"));
expectIncludes("денежное дерево", [30]);
expectIncludes("декабрист", [95]);
expectIncludes("потос", byGenus("epipremnum"));

if (failures.length) {
  console.error(`FAIL indoor search: ${failures.length}`);
  failures.slice(0, 40).forEach((item) => console.error(" -", item));
  if (failures.length > 40) console.error(` ... ещё ${failures.length - 40}`);
  process.exit(1);
}

console.log("PASS indoor search: 147 карточки, синонимы орхидея/сансевиерия/литопс");
