/**
 * Поиск растений по названию: регистр, е/ё, части слов, латинские имена, синонимы.
 * Не используется для оценки соответствия условиям.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PlantSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SHORT_INFIX = 4;

  const GARDEN_ALIASES = {
    picea: ["ель", "елка", "ёлка"],
    pinus: ["сосна"],
    abies: ["пихта"],
    juniperus: ["можжевельник"],
    hosta: ["хоста"],
    chamaecyparis: ["кипарисовик"],
    hydrangea: ["гортензия"],
    spiraea: ["спирея", "таволга"],
    philadelphus: ["чубушник", "жасмин садовый"],
    weigela: ["вейгела"],
    forsythia: ["форзиция"],
    potentilla: ["лапчатка"],
    campanula: ["колокольчик"],
    lavandula: ["лаванда"],
    galanthus: ["подснежник"],
    paeonia: ["пион"],
    lilium: ["лилия"],
    hemerocallis: ["лилейник"],
    calamagrostis: ["вейник"],
    miscanthus: ["мискантус"],
    pennisetum: ["пеннисетум", "перистощетинник"],
    panicum: ["просо"],
    deschampsia: ["луговик", "щучка"],
    molinia: ["молиния"],
    hakonechloa: ["хаконехлоя"],
    sesleria: ["сеслерия"],
    helictotrichon: ["овсец"]
  };

  const INDOOR_ALIASES = {
    phalaenopsis: ["орхидея", "фаленопсис"],
    dendrobium: ["орхидея", "дендробиум"],
    sansevieria: ["сансевиерия", "сансевиера", "щучий хвост", "тещин язык"],
    monstera: ["монстера"],
    ficus: ["фикус"],
    goeppertia: ["калатея"],
    calathea: ["калатея"],
    stromanthe: ["строманта"],
    ctenanthe: ["ктенанта"],
    begonia: ["бегония"],
    aloe: ["алоэ", "алое"],
    lithops: ["литопс", "живые камни"],
    chlorophytum: ["хлорофитум"],
    maranta: ["маранта", "марниера"],
    saintpaulia: ["сенполия", "фиалка", "узамбарская фиалка"],
    spathiphyllum: ["спатифиллум", "женское счастье"],
    zamioculcas: ["замиокулькас", "долларовое дерево"],
    crassula: ["крассула", "толстянка", "денежное дерево"],
    epipremnum: ["эпипремнум", "потос"],
    scindapsus: ["сциндапсус"],
    beaucarnea: ["бокарнея", "нолина", "бутылочное дерево"],
    schlumbergera: ["шлюмбергера", "декабрист"],
    codiaeum: ["кодиеум", "кротон"],
    curio: ["крестовник", "нить жемчуга"],
    ceropegia: ["церопегия", "цепочка сердец"],
    araucaria: ["араукария", "норфолкская сосна", "комнатная ель"],
    soleirolia: ["солейролия", "хелксина"],
    hibiscus: ["гибискус", "китайская роза"],
    stephanotis: ["стефанотис", "мадагаскарский жасмин"],
    sinningia: ["глоксиния"],
    coffea: ["кофе", "кофейное дерево"],
    citrus: ["цитрус", "лимон"],
    kalanchoe: ["каланхоэ", "каланхое"],
    oxalis: ["кислица"],
    tradescantia: ["традесканция"],
    aspidistra: ["аспидистра", "железное растение"],
    dypsis: ["арека", "хризолидокарпус"],
    rhaphidophora: ["рафидофора"]
  };

  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[’'`´]/g, "")
      .replace(/×/g, " ")
      .replace(/[^a-zа-я0-9]+/gi, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  function tokenize(value) {
    const normalized = normalize(value);
    return normalized ? normalized.split(" ") : [];
  }

  function latinGenus(nameLat) {
    const tokens = tokenize(String(nameLat || "").replace(/^\s*×\s*/u, ""));
    return tokens[0] || "";
  }

  function tokenMatches(hayToken, queryToken) {
    if (!queryToken) return true;
    if (!hayToken) return false;
    if (hayToken === queryToken) return true;
    if (hayToken.startsWith(queryToken)) return true;
    return queryToken.length >= SHORT_INFIX && hayToken.includes(queryToken);
  }

  function aliasTokens(plant, aliasMap) {
    const extra = [];
    if (!aliasMap) return extra;
    const genus = latinGenus(plant.nameLat);
    if (genus && aliasMap[genus]) extra.push(...aliasMap[genus]);
    const ruTokens = new Set(tokenize(plant.nameRu));
    for (const [latGenus, aliases] of Object.entries(aliasMap)) {
      const aliasToks = aliases.flatMap(tokenize);
      if (ruTokens.has(latGenus) || aliasToks.some((token) => ruTokens.has(token))) {
        extra.push(latGenus, ...aliases);
      }
    }
    return extra;
  }

  function plantTokens(plant, aliasMap) {
    const parts = [plant.nameRu, plant.nameLat, ...aliasTokens(plant, aliasMap)];
    const tokens = [];
    const seen = new Set();
    for (const part of parts) {
      for (const token of tokenize(part)) {
        if (!seen.has(token)) {
          seen.add(token);
          tokens.push(token);
        }
      }
    }
    return tokens;
  }

  function queryTokens(query) {
    return tokenize(query);
  }

  function matches(plant, query, aliasMap) {
    const needles = queryTokens(query);
    if (!needles.length) return true;
    const hay = plantTokens(plant, aliasMap);
    return needles.every((needle) => hay.some((token) => tokenMatches(token, needle)));
  }

  function search(plants, query, aliasMap) {
    const needles = queryTokens(query);
    if (!needles.length) return plants.slice();
    const seen = new Set();
    const out = [];
    for (const plant of plants) {
      if (!matches(plant, query, aliasMap)) continue;
      if (seen.has(plant.id)) continue;
      seen.add(plant.id);
      out.push(plant);
    }
    return out;
  }

  function relevance(plant, query) {
    const needles = queryTokens(query);
    if (!needles.length) return 0;
    const name = tokenize(plant.nameRu);
    const latin = tokenize(plant.nameLat);
    const q = needles.join(" ");
    if (name.join(" ") === q) return 100;
    if (latin.join(" ") === q) return 95;
    if (name[0] === needles[0]) return 80;
    if (latin[0] === needles[0]) return 75;
    if (name.some((token) => token === needles[0])) return 60;
    return 20;
  }

  return {
    GARDEN_ALIASES,
    INDOOR_ALIASES,
    normalize,
    tokenize,
    latinGenus,
    plantTokens,
    queryTokens,
    matches,
    search,
    relevance
  };
});
