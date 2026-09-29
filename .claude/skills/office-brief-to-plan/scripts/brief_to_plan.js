#!/usr/bin/env node
/* ТЗ заказчика (brief.json) → план офиса продаж для houz planner.
 *
 *   node brief_to_plan.js brief.json --out plan.json [--sheet plan.png]
 *
 * brief.json — состав помещений по опроснику (формат: references/brief-format.md).
 * Скрипт превращает ТЗ в «пакет наполнения» T для движка зонирования (KB.autoPlan),
 * собирает план, подгоняет мебель под ТЗ (стойка ресепшен, стол переговорной) и печатает отчёт:
 * здание и допущения, программа цель/факт, что движок изменил и почему, проверки норм.
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "office-kb.js"));

const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const file = args.find(a => !a.startsWith("--") && !["--out", "--sheet"].some(k => args[args.indexOf(a) - 1] === k));
if (!file) { console.error("node brief_to_plan.js brief.json --out plan.json [--sheet plan.png]"); process.exit(1); }
const B = JSON.parse(fs.readFileSync(file, "utf8"));
const out = opt("--out") || file.replace(/\.json$/, "") + ".plan.json";

/* ---------- здание ---------- */
const bl = B.building || {}, notes = [], assume = [];
const num = v => v == null || v === "" ? null : +String(v).replace(",", ".");
let A = num(bl.area), w = num(bl.w), d = num(bl.d), h = num(bl.h);
if (!h) { h = 4.5; assume.push("высота не указана → 4,5 м (без антресоли)"); }
if (w && d) { if (!A) A = Math.round(w * d); }
else if (w && A) { d = Math.round(A / w * 2) / 2; assume.push(`глубина не указана → ${d} м (площадь ÷ длина)`); }
else if (d && A) { w = Math.round(A / d * 2) / 2; assume.push(`длина не указана → ${w} м (площадь ÷ глубина)`); }
else if (A) { d = null; w = null; }   // размеры подберём ниже: переберём несколько пропорций и возьмём ту, где всё помещается
else { console.error("В ТЗ нет ни площади, ни размеров помещения — спросите заказчика (building.area или building.w/d)."); process.exit(2); }
const up = String(bl.upper || "auto");
const mezz = up === "none" || up === "no" ? "no" : up === "mezz" || up === "yes" ? "yes" : "auto";
if (mezz === "yes" && h < 6.2) assume.push(`антресоль заказана, но высота ${h} м < 6,2 м — проверьте (3,3 м снизу + ≥ 2,2 м сверху)`);

/* ---------- программа из ТЗ ---------- */
const on = v => v !== false && v != null && v !== 0 && v !== "no" && v !== "нет";
const optional = new Set((B.optional || []).concat(Object.entries(B).filter(([, v]) => v === "optional" || v === "если останется место").map(([k]) => k)));
const st = k => optional.has(k) ? { status: "желательно" } : {};
const small = A < 200;   // компактные нормы: мини-кухня, бэк-офис от 6 м², без тамбура < 150 м² и серверной < 220 м²
const rows = [], R = (key, name, zone, cat, o) => rows.push(Object.assign({ key, name, zone, cat, n: "1" }, o, st(key)));

const sales = B.sales || {}, M = Math.max(1, +(sales.managers ?? B.managers ?? 4)), open = String(sales.format || "glass") === "open";
const Bo = +(B.backoffice ?? 0), seats = +(B.waiting ?? Math.max(6, Math.round(1.5 * M)));
const maket = B.maket === false || B.maket === "none" ? null : String(B.maket || (A < 200 ? "3x2" : A < 450 ? "5x3" : "6x4")).replace(/[×х*]/g, "x");
const recepN = +(B.reception ?? 1);

if ((B.tambour === true || A >= 150) && B.tambour !== false) R("tambour", "Тамбур", "public", "circ", { w: 2.6, h: 2.5, border: "glass", sub: true });
if (recepN > 0) { const s = recepN >= 3 ? [4.4, 2.4] : recepN === 2 ? [3.6, 2.2] : [2.4, 1.8];
  R("reception", `Ресепшен (на ${recepN} чел.)`, "public", "client", { w: s[0], h: s[1], border: "none", sub: true }); }
if (seats > 0) R("lounge", `Зона ожидания (${seats} мест)`, "public", "client", { area: "seats * 1.8", border: "none", sub: true });
if (on(B.cafe)) { const bar = /bar|бар/i.test(String(B.cafe));
  R("cafe", bar ? "Бар с бариста и кофе-корнер" : "Кофе-корнер", "public", "client", { w: bar ? 5 : 2.4, h: bar ? 3.2 : 2, border: "none", color: "#D9B98E" }); }
if (maket && maket !== "screen") R("maket", `Зона макета ${maket.replace("x", "×")}`, "public", "client", { area: "maketArea", border: "none", sub: true });
if (on(B.kids)) { const room = /room|комнат/i.test(String(B.kids));
  R("kids", room ? "Детская комната" : "Детский уголок", "public", "client", room ? { w: 4, h: 4, border: "glass", sub: true, color: "#F4D36B" } : { w: 3, h: 3, border: "none", sub: true, color: "#F4D36B" }); }
if (on(B.media) || maket === "screen") R("media", "Медиа / экран", "public", "client", { w: 4, h: 3, border: "none", sub: true });
if (on(B.showroom)) { const big = /mock|мокап/i.test(String(B.showroom));
  R("showroom", big ? "Шоурум: образцы + мокап" : "Шоурум материалов", "semi", "client", { w: big ? 7.5 : 4.5, h: 3.2, border: big ? "glass" : "none" }); }
if (on(B.wardrobe)) { const room = /room|комнат|шкаф/i.test(String(B.wardrobe));
  R("wardrobe", "Гардероб посетителей", "public", "client", { w: room ? 2 : 1.6, h: room ? 3.2 : 1.4 }); }
R("cabinet", open ? "Место консультации (МПП)" : "Кабинет менеджера", "semi", "office", open ? { n: "M", w: 3.0, h: 2.8, border: "none", color: "#DAE8F6" } : { n: "M", w: 3.0, h: 3.2, border: "glass", color: "#9EA3A6" });
const meet = typeof B.meet === "object" && B.meet ? B.meet : on(B.meet) ? { n: +B.meet || 1 } : { n: 0 };
const ms = +(meet.seats || 6), msz = ms <= 4 ? [3.2, 3] : ms <= 6 ? [4.5, 3.2] : ms <= 10 ? [5.5, 3.6] : [6.5, 4];
if (+meet.n > 0) R("meet", `Переговорная на ${ms}`, "semi", "meet", { n: String(+meet.n), w: msz[0], h: msz[1], border: "glass" });
if (+B.vip > 0) R("vip", "Сделочная / VIP", "private", "meet", { n: String(+B.vip), area: A < 420 ? "16" : "20", border: "glass", color: "#A8784E" });
if (+B.bank > 0) R("bank", +B.bank > 1 ? "Банк / ипотека" : "Банк / ипотека (1 сотрудник)", "semi", "office", { n: String(+B.bank), w: 3, h: 3.2, border: "glass" });
if (on(B.cashier)) R("cashier", "Касса", "private", "service", { w: 3, h: 3 });
const wcg = String(B.wc_guest || (A >= 380 ? "mf" : "one"));
R("wcv", /mf|м\s*\+?\s*ж/i.test(wcg) ? "С/у посетителей (М/Ж + МГН)" : "С/у универсальный (МГН)", "public", "wc", { area: /mf|м\s*\+?\s*ж/i.test(wcg) ? "12" : "5.5", color: "#CFE8E6" });
if (+B.wc_staff > 0) R("wcs", "С/у персонала", "service", "wc", { n: String(+B.wc_staff), w: 1.6, h: 2.3, color: "#CFE8E6" });
if (on(B.director)) { if (/back|бэк/i.test(String(B.director))) notes.push("РОП — место в бэк-офисе");
  else R("director", "Кабинет РОП (со столом для встреч)", "service", "back", { w: 4, h: 4, color: "#A8784E" }); }
if (Bo > 0) R("backoffice", `Бэк-офис (${Bo} ${Bo === 1 ? "место" : Bo < 5 ? "места" : "мест"})`, "service", "back", { area: String(Math.max(small ? 6 : 9, Bo * 6)) });
const kit = typeof B.kitchen === "object" && B.kitchen ? B.kitchen : { seats: +B.kitchen || Math.max(4, Math.ceil((M + Bo + 2) / 2)) };
if (B.kitchen !== false) { const mini = /mini|мини/i.test(String(kit.type || (small ? "mini" : ""))); const ks = +kit.seats || 4;
  R("kitchen", mini ? `Мини-кухня (${ks} чел.)` : `Кухня персонала (стол на ${ks})`, "service", "staff", { area: String(mini ? Math.max(6, ks * 1.2) : Math.max(9, ks * 2 + 2)) }); }
if (on(B.archive)) R("archive", "Архив / склад", "service", "service", { w: 2.5, h: 3 });
if (on(B.storage)) R("storage", "Склад POS-материалов", "service", "service", { w: 2, h: 2.5 });
if (on(B.prayer)) R("prayer", "Комната для намаза", "service", "staff", { w: 2, h: 2.5 });
if (B.security) { const s = String(B.security);
  if (/room|комнат/i.test(s)) R("security", "Пост охраны", "public", "service", { w: 2, h: 2 });
  else notes.push(/street|улиц|будк|бутк/i.test(s) ? "пост охраны — будка на улице (вне плана)" : "пост охраны — стол у входа"); }
R("kui", "КУИ", "service", "service", { area: String(Math.max(2, Math.round(A * 0.008 * 2) / 2)) });
R("elec", "Электрощитовая", "service", "service", small ? { w: 1.4, h: 1.8 } : { w: 1.8, h: 2 });
if (B.server === true || (B.server !== false && A >= 220)) R("server", "Серверная", "service", "service", { w: 1.6, h: 2 });

/* что убирать первым, если не помещается: сначала «если останется место» из ТЗ, затем мягкое */
const shrink = [...optional].concat(["seats", "maket", "kids", "cafe", "media", "wardrobe", "storage", "archive"]).filter((k, i, a) => a.indexOf(k) === i);
const MSTEPS = ["6x5", "6x4", "5x3", "3x2", "2x1.5"];
KB.PACKAGES.T = { name: "По ТЗ заказчика", sub: B.name || "", min: 40, max: 3000, A, k: 1.3, depth: d || 12, h, gap: 1.0,
  maketMin: maket && MSTEPS.includes(maket) ? MSTEPS[Math.min(MSTEPS.indexOf(maket) + 1, MSTEPS.length - 1)] : "2x1.5",
  minN: { cabinet: M }, vars: { M: String(M), B: String(Bo), seats: String(seats), maket: `'${maket && MSTEPS.includes(maket) ? maket : "3x2"}'` },
  grow: [], shrink, rows };

const name = B.name ? `${B.name} — офис продаж ${Math.round(A)} м²` : `Офис продаж ${Math.round(A)} м²`;
const MSTEPS2 = MSTEPS;
function finish(S) {
  /* ---------- мебель по ТЗ ---------- */
  const fit = (it, key, i) => { const s = KB.SIZES[key] && KB.SIZES[key][i]; if (!s) return; const q = (it.rot || 0) % 180;
    const cx = it.x + (q ? it.h : it.w) / 2, cy = it.y + (q ? it.w : it.h) / 2; it.w = s[1]; it.h = s[2];
    it.x = +(cx - (q ? s[2] : s[1]) / 2).toFixed(3); it.y = +(cy - (q ? s[1] : s[2]) / 2).toFixed(3); };
  const items = k => S.items.filter(i => i.t === "item" && i.k === k);
  items("recep").forEach(it => fit(it, "recep", recepN >= 3 ? 3 : recepN === 2 ? 1 : 0));
  const mi = ms <= 4 ? 0 : ms <= 6 ? 1 : ms <= 8 ? 2 : ms <= 10 ? 3 : ms <= 12 ? 4 : 5;
  S.items.filter(i => i.t === "item" && /^meet(6|8|10)$/.test(i.k)).forEach(it => {
    const room = S.items.find(x => x.t === "room" && x.lv === it.lv && it.x >= x.x - .01 && it.y >= x.y - .01 && it.x <= x.x + x.w && it.y <= x.y + x.h);
    if (room && /Переговорн/.test(room.name)) { it.k = "meet6"; fit(it, "meet6", mi); } });

  /* ---------- доразмещение: то, что движок не смог поставить, ищем в свободных местах ----------
   * Движок раскладывает зал рядами и в маленьких / неглубоких помещениях иногда роняет макет, детскую
   * или часть мест ожидания, хотя место в зале есть. Пробуем найти для них свободный прямоугольник
   * (зона макета уже включает обход 1 м; остальным — зазор 0,6 м), начиная с обязательного. Всё найденное отмечаем в отчёте. */
  const rescued = [];
  const halls = () => S.items.filter(i => i.t === "room" && !i.lv && /^(Зал продаж|Холл)(\s|$)/.test(i.name)).sort((a, b) => b.w * b.h - a.w * a.h);
  const tryPlace = (row, w, h, lv, near) => {
    const areas = lv || row.zone === "service" ? [null] : halls().map(x => x.id);   // публичное — в зале продаж, затем в холлах
    // зазор: у зоны без стен проход уже внутри неё; помещению со стенами сначала 0,6 м, в тесном холле — 0,2 м (встаёт к стене)
    for (const c of row.border === "none" ? [0.3] : [0.6, 0.2]) for (const within of areas) for (const [ww, hh] of [[w, h], [h, w]]) {
      const sp = KB.findSpace(S, Object.assign({ w: +(ww + 2 * c).toFixed(2), h: +(hh + 2 * c).toFixed(2), lv, near, limit: 1 }, within ? { within } : {}))[0];
      if (!sp) continue;
      KB.applyAll(S, [{ op: "add_room", name: row.name, x: +(sp.x + c).toFixed(2), y: +(sp.y + c).toFixed(2), w: ww, h: hh, lv, cat: row.cat, border: row.border || "wall", sub: !!row.sub || row.border === "none" || !!within, color: row.color }]);   // внутри зала/холла — вложенное помещение (площадь уже в зале)
      return true; }
    return false; };
  const missingNow = () => missingOf(S);
  const PRI = ["cabinet", "meet", "vip", "bank", "cashier", "maket", "reception", "lounge", "cafe", "kids", "showroom", "media", "wardrobe"];
  const pr = k => { const i = PRI.indexOf(k); return i < 0 ? PRI.length : i; };
  for (const f of missingNow().sort((x, y) => ((x.status === "обязательно" ? 0 : 100) + pr(x.key)) - ((y.status === "обязательно" ? 0 : 100) + pr(y.key)))) {
    const row = rows.find(r => r.key === f.key); if (!row) continue;
    for (let k = f.placed; k < f.n; k++) {
      let ok = false;
      if (row.key === "maket") {
        for (const m of MSTEPS.slice(Math.max(0, MSTEPS.indexOf(maket)))) { const t = KB.MAKET[m]; if (!t) continue;
          const r2 = Object.assign({}, row, { name: `Зона макета ${m.replace("x", "×")}` });
          if (tryPlace(r2, +(t[0] + 2).toFixed(2), +(t[1] + 2).toFixed(2), 0, "facade")) { ok = true; rescued.push(`${r2.name} — поставлена в свободное место зала`); break; } }
      } else {
        const w = +row.w || +Math.sqrt((+row.area || 9) * 1.3).toFixed(1), h = +row.h || +((+row.area || 9) / w).toFixed(1);
        const lvs = row.zone === "service" && S.items.some(i => i.t === "room" && i.lv === 1) ? [1, 0] : [0];
        for (const lv of lvs) if (tryPlace(row, w, h, lv, row.zone === "public" ? "facade" : "back")) { ok = true; rescued.push(`${row.name} — ${lv ? "на антресоли" : "в свободном месте"}`); break; }
      }
      if (!ok) break;
    }
  }
  if (S.meta.seatsWanted > (S.meta.seatsPlaced || 0)) {        // недостающие места ожидания — группами по 3
    let need = S.meta.seatsWanted - (S.meta.seatsPlaced || 0), n = 0;
    while (need > 0 && tryPlace({ name: "Зона ожидания", zone: "public", cat: "client", border: "none", sub: true }, 2.4, 2.2, 0, "facade")) { need -= 3; n++; }
    if (n) { S.meta.seatsPlaced = Math.min(S.meta.seatsWanted, S.meta.seatsPlaced + n * 3); rescued.push(`ещё ${n} ${n === 1 ? "группа" : "группы"} ожидания (по 3 места)`); }
  }
  return rescued;
}
const missingOf = S => { const fact = KB.programFact(S);
  return rows.map(row => { const f = fact.find(x => x.key === row.key); const n = row.n === "M" ? M : +row.n || 1;
    const byName = S.items.filter(i => i.t === "room" && (i.name === row.name || (row.key === "maket" && /^Зона макета/.test(i.name)))).length;   // доразмещённое движок не знает
    return { key: row.key, n, placed: Math.min(n, Math.max(f ? f.placed : 0, byName)), status: row.status || "обязательно" }; }).filter(f => f.placed < f.n); };
const score = (x, S) => missingOf(S).reduce((a, q) => a + (q.n - q.placed) * (q.status === "обязательно" ? 10 : 3), 0)
  + Math.max(0, (S.meta.seatsWanted || 0) - (S.meta.seatsPlaced || 0)) + KB.checks(S).filter(c => c.level === "red").length * 5
  + x.log.filter(l => /макет|→/.test(l)).length * 2;          // уменьшенный макет / урезанные количества — тоже потеря
let r, rescued;
if (w && d) { r = KB.autoPlan({ pkg: "T", w, d, h, mezz, name }); rescued = finish(r.project); }
else {   // типичные глубины помещений офиса продаж в ЖК (витраж по длинной стороне); каждую доводим до конца и сравниваем
  const depths = A <= 120 ? [7.5, 8, 9, 10] : A <= 220 ? [8.5, 9.5, 10.5, 11.5] : A <= 350 ? [10, 11, 12, 13] : [12, 12.5, 13, 14];
  let best = null;
  for (const dd of depths) { const ww = Math.round(A / dd * 2) / 2; const x = KB.autoPlan({ pkg: "T", w: ww, d: dd, h, mezz, name }); const rs = finish(x.project); x._s = score(x, x.project);
    if (!best || x._s < best._s) { best = x; w = ww; d = dd; rescued = rs; } }
  r = best;
  assume.push(`размеры не указаны → ${String(w).replace(".", ",")} × ${String(d).replace(".", ",")} м (≈ ${Math.round(w * d)} м²; из глубин ${depths.join(" / ")} м выбрана та, где ТЗ выполняется полнее; витраж по длинной стороне)`);
}
const S = r.project;

/* ---------- отчёт ---------- */
const fact = KB.programFact(S), checks = KB.checks(S);
const a0 = (w - 0.6) * (d - 0.6);   // пол 1 этажа внутри стен (помещения-зоны лежат внутри зала — их не суммируем)
const a1 = S.items.filter(i => i.t === "room" && i.lv === 1 && !i.sub).reduce((s, i) => s + i.w * i.h, 0);
S.notes = [`По ТЗ заказчика${B.name ? " «" + B.name + "»" : ""}. Здание ${w} × ${d} м, потолок ${h} м.`, assume.length ? "Допущения: " + assume.join("; ") + "." : "",
  notes.length ? notes.join("; ") + "." : "", B.notes || ""].filter(Boolean).join(" ");
S.meta.params = Object.assign({}, S.meta.params, { pkg: "T", brief: B });
fs.writeFileSync(out, JSON.stringify(S));

const f2 = v => (Math.round(v * 10) / 10).toLocaleString("ru-RU");
const L = [];
L.push(`# ${S.name}`, "", `Здание: ${f2(w)} × ${f2(d)} м, потолок ${f2(h)} м → 1 этаж ≈ ${f2(a0)} м² внутри стен` + (a1 ? `, ${S.b.upper === "floor" ? "2 этаж" : "антресоль"} ${f2(a1)} м² (${Math.round(a1 / a0 * 100)}% от 1 этажа)` : ", без антресоли"));
if (assume.length) L.push("", "Допущения:", ...assume.map(x => "- " + x));
if (notes.length) L.push("", "Вне плана / решения:", ...notes.map(x => "- " + x));
L.push("", "Программа (цель → факт):");
for (const f of fact) L.push(`- ${f.name}: ${f.n} → ${f.placed}${f.placed < f.n ? "  ⚠ не поместилось" : ""}${f.factArea ? ` · ${f2(f.factArea)} м²` : ""}`);
if (S.meta.seatsWanted) L.push(`- мест ожидания: ${S.meta.seatsWanted} → ${S.meta.seatsPlaced}`);
if (r.log.length) L.push("", "Что движок изменил, чтобы всё поместилось:", ...r.log.map(x => "- " + x));
if (rescued.length) L.push("", "Доразмещено после движка (проверьте на листе):", ...rescued.map(x => "- " + x));
const lost = missingOf(S).map(f => { const row = rows.find(x => x.key === f.key); return `${row.name}${f.n > 1 ? ` (${f.placed} из ${f.n})` : ""}${f.status !== "обязательно" ? " — было «если останется место»" : ""}`; });
if ((S.meta.seatsPlaced || 0) < (S.meta.seatsWanted || 0)) lost.push(`мест ожидания ${S.meta.seatsPlaced || 0} из ${S.meta.seatsWanted} (по ТЗ ${seats})`);
L.push("", lost.length ? "⚠ ИЗ ТЗ НЕ ПОМЕСТИЛОСЬ (обязательно скажите заказчику и предложите варианты):" : "Всё из ТЗ на плане.", ...lost.map(x => "- " + x));
const stillMissing = new Set(missingOf(S).map(f => (rows.find(x => x.key === f.key) || {}).name));
const warns = r.warnings.filter(x => { const m = /^Не поместилось: (.+)\.$/.exec(x); return !m || stillMissing.has(m[1]); })
  .filter(x => !/^Мест ожидания/.test(x) || (S.meta.seatsPlaced || 0) < (S.meta.seatsWanted || 0)).filter((x, i, a) => a.indexOf(x) === i);
if (warns.length) L.push("", "Замечания раскладки:", ...warns.map(x => "- " + x));
const red = checks.filter(c => c.level === "red"), yel = checks.filter(c => c.level === "yellow" || c.level === "warn");
L.push("", `Проверки норм: красных ${red.length}, жёлтых ${yel.length}`, ...red.concat(yel).map(c => `- [${c.level}] ${c.text || c.msg || c.title}${c.ref ? " (" + c.ref + ")" : ""}`));
L.push("", `Файл проекта: ${out}`);
console.log(L.join("\n"));

if (opt("--sheet")) {
  const rs = require(path.join(__dirname, "render_sheet.js"));
  rs.render(out, opt("--sheet")).then(p => console.log(`Лист «план + изометрия»: ${p}`)).catch(e => console.log(`Лист не отрисован: ${e.message}`));
}
