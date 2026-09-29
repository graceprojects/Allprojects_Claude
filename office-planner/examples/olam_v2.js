// «ОЛАМ НАЗАРБЕК» v2 — по опроснику заказчика, движок зонирования v2 + мебель по типоразмерам.
// Программа — строго по ТЗ (что отмечено в опроснике), размеры помещения в ТЗ не указаны: 40 × 12,5 м (500 м²), потолок 6,5 м.
const KB = require("../src/office-kb.js"), fs = require("fs"), path = require("path");
KB.PACKAGES.T = { name: "По ТЗ заказчика", sub: "ОЛАМ НАЗАРБЕК", min: 60, max: 1500, A: 500, k: 1.3, depth: 12.5, h: 6.5, gap: 1.0, maketMin: "5x3", minN: { cabinet: 5 },
  vars: { M: "5", B: "3", seats: "12", maket: "'6x5'" }, grow: [], shrink: ["showroom", "kids", "seats", "maket"],
  rows: [
    { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.6, h: 2.5, border: "glass", sub: true },
    { key: "reception", name: "Ресепшен (на 2 чел.)", zone: "public", cat: "client", n: "1", w: 3.6, h: 2.2, border: "none", sub: true },
    { key: "lounge", name: "Зона ожидания (10–12 мест)", zone: "public", cat: "client", n: "1", area: "seats * 1.8", border: "none", sub: true },
    { key: "cafe", name: "Бар с бариста и кофе-корнер", zone: "public", cat: "client", n: "1", w: 5, h: 3.2, border: "none", color: "#D9B98E" },
    { key: "maket", name: "Зона макета 6×5", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true },
    { key: "kids", name: "Детский уголок", zone: "public", cat: "client", n: "1", w: 3, h: 3, border: "none", sub: true, status: "желательно", color: "#F4D36B" },
    { key: "showroom", name: "Шоурум материалов (отделка, двери, окна)", zone: "semi", cat: "client", n: "1", w: 4.5, h: 3.2, border: "none", status: "желательно" },
    { key: "cabinet", name: "Место консультации (МПП)", zone: "semi", cat: "office", n: "M", w: 3.0, h: 2.8, border: "none", color: "#DAE8F6" },
    { key: "meet", name: "Переговорная на 6", zone: "semi", cat: "meet", n: "1", w: 4.5, h: 3.2, border: "glass" },
    { key: "bank", name: "Банк / касса (1 сотрудник)", zone: "semi", cat: "office", n: "1", w: 3, h: 3.2, border: "glass" },
    { key: "wcv", name: "С/у посетителей (М/Ж + МГН)", zone: "public", cat: "wc", n: "1", area: "12", color: "#CFE8E6" },
    { key: "kui", name: "КУИ", zone: "service", cat: "service", n: "1", area: "4" },
    { key: "elec", name: "Электрощитовая", zone: "service", cat: "service", n: "1", w: 1.8, h: 2 },
    { key: "director", name: "Кабинет РОП (со столом для встреч)", zone: "service", cat: "back", n: "1", w: 4, h: 4, color: "#A8784E" },
    { key: "backoffice", name: "Бэк-офис (3 места)", zone: "service", cat: "back", n: "1", area: "18" },
    { key: "kitchen", name: "Кухня персонала (стол на 6)", zone: "service", cat: "staff", n: "1", area: "14" },
    { key: "archive", name: "Архив / склад (документы, POS, подарки)", zone: "service", cat: "service", n: "1", w: 2.5, h: 3 },
    { key: "server", name: "Серверная", zone: "service", cat: "service", n: "1", w: 1.6, h: 2 },
  ] };
const r = KB.autoPlan({ pkg: "T", w: 40, d: 12.5, h: 6.5, mezz: "auto", name: "ОЛАМ НАЗАРБЕК — офис продаж 500 м² (v2)" });
const S = r.project, items = S.items, A = (k, name) => items.filter(i => i.t === "item" && i.k === k);
// мебель по типоразмерам ТЗ
const fit = (it, key, i) => { const s = KB.SIZES[key][i]; const cx = it.x + (it.rot % 180 ? it.h : it.w) / 2, cy = it.y + (it.rot % 180 ? it.w : it.h) / 2; it.w = s[1]; it.h = s[2]; const q = it.rot % 180; it.x = +(cx - (q ? s[2] : s[1]) / 2).toFixed(3); it.y = +(cy - (q ? s[1] : s[2]) / 2).toFixed(3); };
for (const it of A("recep")) fit(it, "recep", 1);          // стойка на 2 чел. 2400
for (const it of A("meet6").concat(A("meet8"), A("meet10"))) { it.k = "meet6"; fit(it, "meet6", 1); }   // стол на 6
S.notes = "По опроснику «ОЛАМ НАЗАРБЕК» (500 м², потолок 6–7 м → принято 6,5; размеры не указаны → 40 × 12,5 м). " +
  "Собрано движком зонирования v2: 5 открытых мест консультаций (МПП), РОП, переговорная на 6, банк/касса на 1 сотрудника, ресепшен на 2, ожидание 12 мест, бар с бариста + кофе-корнер, детский уголок в зале, макет 6×5, шоурум материалов, с/у М + Ж + МГН (общие с персоналом). " +
  "Антресоль ~20%: кабинет РОП, бэк-офис на 3, кухня со столом на 6, архив/склад, серверная. Не нужно: сделочная, VR, гардероб, с/у персонала. Пост охраны — будка на улице (вне плана).";
S.meta.params = Object.assign({}, S.meta.params, { pkg: "T" });
fs.writeFileSync(path.join(__dirname, "olam-nazarbek-v2.json"), JSON.stringify(S));
console.log(r.brief); console.log(r.log.join("\n")); console.log(r.warnings.join(" | ")); console.log(KB.summary(S));
