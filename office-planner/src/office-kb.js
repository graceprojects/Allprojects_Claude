/* Офис продаж: база знаний, генератор планировки и проверки норм.
 * Один файл для двух потребителей:
 *   - планировщик (index.html) — встраивается между маркерами KB:BEGIN / KB:END (build.py);
 *   - скилл Claude (.claude/skills/sales-office-planning/scripts) — через Node: require('./office-kb.js').
 * Координаты — метры, X вдоль дороги, Y вглубь (Y = D — витражный фасад у дороги).
 * Площади — в чистоте. Числа — ориентиры для эскиза заказчика, окончательно проверяет проектировщик.
 */
(function (root) {
  "use strict";
  const KB = { version: "1.0" };

  KB.CAT = {
    client: { n: "Клиентская зона", c: "#F3E6CF" }, office: { n: "Кабинеты продаж", c: "#DAE8F6" },
    meet: { n: "Переговорные", c: "#F7D9C2" }, back: { n: "Бэк-офис", c: "#E5DBF2" },
    staff: { n: "Помещения персонала", c: "#E0ECD8" }, service: { n: "Служебные / технические", c: "#E2E2DC" },
    wc: { n: "Санузлы", c: "#D3EEEA" }, circ: { n: "Коммуникации", c: "#EDEDE6" },
  };
  // Зоны приватности: от входа вглубь и снизу вверх
  KB.ZONES = { public: "Публичная", semi: "Полупубличная", private: "Закрытая клиентская", service: "Служебная" };

  // Размеры мебели, которую ставит генератор (w × h, м) — совпадают с каталогом планировщика
  const DIMS = {
    door9: [.9, 1.2], door18: [1.8, 1.2], slide: [1, .3], recep: [3, .8], model: [5, 3], lounge: [2.2, 2.9],
    kidtab: [1, .6], kidmat: [2, 2], led: [2, .2], plant: [.6, .6], cooler: [.35, .35], work3: [1.6, 2.3],
    deskB: [1.8, .9], chairO: [.6, .6], chairV: [.5, .5], os4: [2.8, 2.6], os1: [1.4, 1.3], cab: [.9, .45], shelf: [1, .4],
    safe: [.5, .5], desk: [1.6, .8], meet6: [2.4, 2.1], meet8: [3.2, 2.2], kitch: [2.4, .6], fridge: [.7, .7],
    dine: [1.9, 1.9], bar: [3, .6], stool: [.45, .45], wc: [.4, .7], sink: [.55, .45], cubicle: [1.2, 1.8],
    stair2: [2.6, 4], mfp: [.6, .5], sofa2: [1.6, .9], stand: [1.2, .4],
  };

  KB.DEFAULTS = {
    name: "Офис продаж", w: 40, d: 12, h: 7, M: 6, B: 6, maket: "5x3",
    kids: true, cafe: true, wardrobe: true, bank: true, cashier: false, media: false, showroom: false,
    director: true, mezz: "auto", front: "vitrage",
  };
  KB.MAKET = { "2x1.5": [2, 1.5], "3x2": [3, 2], "5x3": [5, 3], "6x4": [6, 4] };

  /* ------------------------------------------------------------ пакеты офиса продаж по площади
   * Каждый пакет — таблица строк программы. Количество (n) и площадь (area) могут быть формулами.
   * Переменные формул: A — площадь офиса (м², внутри стен), M — менеджеров (мест консультаций), B — бэк-офис,
   * seats — мест ожидания; функции: min, max, round, ceil, floor, clamp(x, a, b).
   * status: «обязательно» — всегда; «желательно» — включено, можно выключить; «опция» — выключено, можно включить.
   */
  KB.PACKAGES = {
    S: { name: "Мини", sub: "80–150 м²", min: 80, max: 150, A: 100, k: 1.3, depth: 10, h: 3.6, compact: true, gap: 0.9,
      vars: { M: "A <= 115 ? 2 : 3", B: "A <= 115 ? 1 : 2", seats: "max(4, 2 * M)", maket: "A <= 115 ? '2x1.5' : '3x2'" },
      about: "Павильон или помещение на первом этаже. Открытые места консультаций, одна переговорная-сделочная, один универсальный санузел, мини-кухня.",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.4, h: 2.5, border: "glass", status: "опция", rule: "по умолчанию — тепловая завеса над входом; тамбур глубиной ≥ 2,45 м для МГН", sub: true },
        { key: "reception", name: "Ресепшен / хостес", zone: "public", cat: "client", n: "1", w: 1.8, h: 1.6, border: "none", sub: true, rule: "стойка 1,2–1,4 м у входа; можно совместить с местом консультации" },
        { key: "lounge", name: "Зона ожидания", zone: "public", cat: "client", n: "1", area: "max(6, seats * 1.6)", border: "none", sub: true, rule: "диван + кресла, вешалка; 1,6 м² на место" },
        { key: "cafe", name: "Кофе-корнер", zone: "public", cat: "client", n: "1", w: 2, h: 1.5, border: "none", status: "желательно", color: "#D9B98E", rule: "стойка с кофемашиной и кулером" },
        { key: "maket", name: "Зона макета / экран", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 2×1,5 (до 115 м²) или 3×2 + обход 0,9 м; можно заменить большим экраном" },
        { key: "kids", name: "Детский уголок", zone: "public", cat: "client", n: "1", w: 2, h: 2, border: "none", sub: true, status: "опция", color: "#F4D36B", rule: "коврик и столик в поле зрения родителей" },
        { key: "cabinet", name: "Место консультации", zone: "semi", cat: "office", n: "M", w: 2.8, h: 2.6, border: "none", color: "#DAE8F6", rule: "открытый стол менеджера + 2 кресла клиента, 7,3 м²" },
        { key: "vip", name: "Переговорная-сделочная на 4", zone: "private", cat: "meet", n: "1", area: "9", border: "glass", color: "#A8784E", rule: "закрытая, для подписания договоров, 3×3 м" },
        { key: "wcv", name: "Санузел универсальный (МГН)", zone: "public", cat: "wc", n: "1", area: "5", color: "#CFE8E6", rule: "один на посетителей и персонал (допустимо при ≤ 10 чел.), 2,20×2,25 м" },
        { key: "kitchen", name: "Мини-кухня / приём пищи", zone: "service", cat: "staff", n: "1", area: "6", rule: "место 6 м² при ≤ 10 работающих (СП 44, сверить)" },
        { key: "backoffice", name: "Рабочее место бэк-офиса", zone: "service", cat: "back", n: "1", area: "max(4.5, B * 4.5)", rule: "4,5 м² на место с ПК" },
        { key: "kui", name: "Шкаф уборочного инвентаря", zone: "service", cat: "service", n: "1", w: 1, h: 1, rule: "встроенный шкаф с раковиной или в санузле" },
        { key: "elec", name: "Электрощит и слаботочка", zone: "service", cat: "service", n: "1", w: 1.2, h: 1.5, rule: "шкаф ЩР + серверная стойка" },
      ] },
    M: { name: "Стандарт", sub: "200–320 м²", min: 200, max: 320, A: 280, k: 1.35, depth: 12, h: 4.5, gap: 1.2,
      vars: { M: "clamp(round((A - 120) / 40), 3, 5)", B: "clamp(round(A / 80), 2, 4)", seats: "max(6, round(1.5 * M))", maket: "'3x2'" },
      about: "Полноценный офис: кабинеты менеджеров, переговорная и сделочная, зона макета, детский уголок, кухня и бэк-офис.",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.6, h: 2.5, border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу (СП 59)", sub: true },
        { key: "reception", name: "Ресепшен", zone: "public", cat: "client", n: "1", w: 4.4, h: 2.4, border: "none", sub: true, rule: "стойка 2,4–3 м, видна от входа" },
        { key: "wardrobe", name: "Гардероб посетителей", zone: "public", cat: "client", n: "1", w: 1.5, h: 3.2, status: "желательно", rule: "штанга 1,5 м или шкаф" },
        { key: "lounge", name: "Зона ожидания", zone: "public", cat: "client", n: "1", area: "seats * 1.8", border: "none", sub: true, rule: "max(6; 1,5·M) мест × 1,8 м²" },
        { key: "cafe", name: "Кофе-поинт", zone: "public", cat: "client", n: "1", w: 3, h: 3.2, border: "none", status: "желательно", color: "#D9B98E", rule: "стойка + 2 стола, мокрая точка" },
        { key: "maket", name: "Зона макета", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 3×2 + обход 1,2 м" },
        { key: "kids", name: "Детский уголок", zone: "public", cat: "client", n: "1", w: 3, h: 3, border: "none", sub: true, status: "желательно", color: "#F4D36B", rule: "виден из зоны ожидания" },
        { key: "cabinet", name: "Кабинет менеджера", zone: "semi", cat: "office", n: "M", w: 3, h: 3.2, border: "glass", color: "#9EA3A6", rule: "стекло в зал, 9,6 м²" },
        { key: "meet", name: "Переговорная на 6", zone: "semi", cat: "meet", n: "1", w: 4.5, h: 3.2, border: "glass", rule: "акустика Rw ≥ 42 дБ" },
        { key: "bank", name: "Ипотека / банк-партнёр", zone: "semi", cat: "office", n: "1", w: 3, h: 3.2, border: "glass", status: "опция" },
        { key: "vip", name: "Сделочная / VIP", zone: "private", cat: "meet", n: "1", area: "16", border: "glass", color: "#A8784E", rule: "подписание, 4–6 человек" },
        { key: "wcv", name: "С/у посетителей (МГН)", zone: "public", cat: "wc", n: "1", area: "5.5", color: "#CFE8E6", rule: "универсальная кабина ≥ 2,20×2,25" },
        { key: "wcs", name: "С/у персонала", zone: "service", cat: "wc", n: "1", w: 1.5, h: 2, color: "#CFE8E6" },
        { key: "kitchen", name: "Кухня / приём пищи", zone: "service", cat: "staff", n: "1", area: "max(9, M + B + 1)", rule: "1 м² на человека, не меньше 9 м²" },
        { key: "backoffice", name: "Бэк-офис", zone: "service", cat: "back", n: "1", area: "B * 4.5", rule: "4,5 м² на место с ПК" },
        { key: "director", name: "Кабинет руководителя", zone: "service", cat: "back", n: "1", w: 3, h: 3.5, status: "опция", color: "#A8784E" },
        { key: "kui", name: "КУИ", zone: "service", cat: "service", n: "1", w: 1.5, h: 1.5, rule: "кладовая уборочного инвентаря" },
        { key: "elec", name: "Электрощитовая", zone: "service", cat: "service", n: "1", w: 2, h: 1.5 },
        { key: "server", name: "Серверная / архив", zone: "service", cat: "service", n: "1", w: 1.5, h: 2 },
      ] },
    L: { name: "Флагман", sub: "350–600 м²", min: 350, max: 600, A: 500, k: 1.25, depth: 15, h: 7, gap: 1.2,
      vars: { M: "clamp(round((A - 200) / 45), 6, 10)", B: "clamp(round(A / 70), 5, 9)", seats: "max(10, round(1.5 * M))", maket: "A >= 560 ? '6x4' : '5x3'" },
      about: "Флагманский офис: бар, большой макет, медиа-зона, детская комната, шоурум материалов, две переговорные, кабинет РОП, бэк-офис (можно на антресоли).",
      rows: [
        { key: "tambour", name: "Тамбур", zone: "public", cat: "circ", n: "1", w: 2.6, h: 2.5, border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу", sub: true },
        { key: "reception", name: "Ресепшен / хостес", zone: "public", cat: "client", n: "1", w: 4.4, h: 2.4, border: "none", sub: true, rule: "стойка 3 м + зона встречи" },
        { key: "wardrobe", name: "Гардероб посетителей", zone: "public", cat: "client", n: "1", w: 2, h: 3.2 },
        { key: "lounge", name: "Лаунж / зона ожидания", zone: "public", cat: "client", n: "1", area: "seats * 1.8", border: "none", sub: true, rule: "max(10; 1,5·M) мест × 1,8 м²" },
        { key: "cafe", name: "Бар / кафе", zone: "public", cat: "client", n: "1", w: 5, h: 3.2, border: "none", color: "#D9B98E", rule: "барная стойка + столики, мокрая точка" },
        { key: "maket", name: "Зона макета", zone: "public", cat: "client", n: "1", area: "maketArea", border: "none", sub: true, rule: "стол 5×3 (6×4 от 560 м²) + обход 1,2 м" },
        { key: "media", name: "Медиа / VR зона", zone: "public", cat: "client", n: "1", w: 4, h: 3, border: "none", sub: true, status: "желательно" },
        { key: "kids", name: "Детская комната", zone: "public", cat: "client", n: "1", w: 4, h: 4, border: "none", sub: true, color: "#F4D36B", rule: "видна из лаунжа, не у входа и не у переговорных" },
        { key: "showroom", name: "Шоурум материалов (отделка, мокапы)", zone: "semi", cat: "client", n: "1", w: 7.5, h: 3.2, border: "glass", status: "желательно", rule: "образцы отделки, мокапы кухни и с/у 1:1" },
        { key: "cabinet", name: "Кабинет менеджера", zone: "semi", cat: "office", n: "M", w: 3, h: 3.2, border: "glass", color: "#9EA3A6", rule: "стекло в зал, 9,6 м²" },
        { key: "meet", name: "Переговорная на 6", zone: "semi", cat: "meet", n: "2", w: 4.5, h: 3.2, border: "glass", rule: "две: для подбора и для групп" },
        { key: "bank", name: "Ипотека / банк-партнёр", zone: "semi", cat: "office", n: "M > 8 ? 2 : 1", w: 3, h: 3.2, border: "glass", rule: "рядом со сделочной" },
        { key: "vip", name: "Сделочная / VIP", zone: "private", cat: "meet", n: "M > 8 ? 2 : 1", area: "22", border: "glass", color: "#A8784E", rule: "18–25 м²" },
        { key: "cashier", name: "Касса", zone: "private", cat: "service", n: "1", w: 3, h: 3, status: "опция", rule: "при эскроу обычно не нужна" },
        { key: "director", name: "Кабинет РОП", zone: "service", cat: "back", n: "1", w: 4, h: 4.5, color: "#A8784E", rule: "руководитель отдела продаж, 18 м²" },
        { key: "backoffice", name: "Бэк-офис open-space", zone: "service", cat: "back", n: "1", area: "B * 6", rule: "6 м² на место (≥ 4,5)" },
        { key: "kitchen", name: "Кухня / комната приёма пищи", zone: "service", cat: "staff", n: "1", area: "max(12, M + B + 3)", rule: "1 м² на человека в смене, ≥ 12 м²" },
        { key: "wcv", name: "С/у посетителей (М/Ж + МГН)", zone: "public", cat: "wc", n: "1", area: "12", color: "#CFE8E6", rule: "2 кабины + универсальная МГН" },
        { key: "wcs", name: "С/у персонала", zone: "service", cat: "wc", n: "ceil((M + B + 3) / 15)", w: 1.8, h: 2.5, color: "#CFE8E6" },
        { key: "kui", name: "КУИ", zone: "service", cat: "service", n: "1", w: 1.8, h: 2 },
        { key: "elec", name: "Электрощитовая", zone: "service", cat: "service", n: "1", w: 2, h: 2.5 },
        { key: "server", name: "Серверная", zone: "service", cat: "service", n: "1", w: 2, h: 2 },
        { key: "archive", name: "Архив", zone: "service", cat: "service", n: "1", w: 2.5, h: 2.5, rule: "запираемый (152-ФЗ)" },
        { key: "storage", name: "Склад POS-материалов", zone: "service", cat: "service", n: "1", w: 2, h: 2.5, status: "желательно" },
        { key: "security", name: "Пост охраны", zone: "service", cat: "service", n: "1", w: 2, h: 1.8, status: "опция" },
      ] },
  };
  KB.DEFAULT_PACKAGES = JSON.parse(JSON.stringify(KB.PACKAGES));
  KB.STATUSES = ["обязательно", "желательно", "опция"];

  // Безопасный калькулятор формул: только числа, переменные, + - * / ( ) ? : < > = ! & | , ' и функции min/max/round/ceil/floor/clamp
  KB.evalExpr = function (expr, vars) {
    if (typeof expr === "number") return expr;
    const src = String(expr == null ? "" : expr).trim().replace(/,(?=\d)/g, ".");
    if (!src) return 0;
    if (!/^[\w\s.+\-*/()?:<>=!&|,'"]*$/.test(src)) throw new Error("Недопустимые символы в формуле: " + src);
    const allowed = new Set(["min", "max", "round", "ceil", "floor", "clamp", ...Object.keys(vars)]);
    const ids = src.replace(/'[^']*'|"[^"]*"/g, "").match(/[A-Za-z_]\w*/g) || [];
    for (const id of ids) if (!allowed.has(id)) throw new Error(`Неизвестное имя «${id}» в формуле: ${src}`);
    const fn = new Function("min", "max", "round", "ceil", "floor", "clamp", ...Object.keys(vars), "return (" + src + ");");
    return fn(Math.min, Math.max, Math.round, Math.ceil, Math.floor, (x, a, b) => Math.min(b, Math.max(a, x)), ...Object.values(vars));
  };

  // Программа из пакета: rows с вычисленными n и area; opts[key] включает/выключает строки; counts[key] — ручное количество
  KB.packageProgram = function (pkgKey, A, opts = {}, counts = {}, pkgDef) {
    const P = pkgDef || KB.PACKAGES[pkgKey]; if (!P) throw new Error("Нет пакета " + pkgKey);
    const v = { A: +A || P.A };
    v.M = Math.max(1, Math.round(KB.evalExpr(P.vars.M, v)));
    if (counts.cabinet != null) v.M = Math.max(1, +counts.cabinet);
    v.B = Math.max(0, Math.round(KB.evalExpr(P.vars.B, v)));
    v.seats = Math.max(1, Math.round(KB.evalExpr(P.vars.seats, v)));
    const maket = String(KB.evalExpr(P.vars.maket || "'3x2'", v)); const mk = KB.MAKET[maket] || KB.MAKET["3x2"];
    v.maketArea = +((mk[0] + 2 * (P.gap || 1.2)) * (mk[1] + 2 * (P.gap || 1.2))).toFixed(2);
    const rows = [];
    for (const r of P.rows) {
      const on = r.status === "опция" ? !!opts[r.key] : (r.status === "желательно" ? opts[r.key] !== false : true);
      if (!on) continue;
      let n = counts[r.key] != null ? +counts[r.key] : Math.round(KB.evalExpr(r.n ?? "1", v));
      if (!(n > 0)) continue;
      let w = +r.w || 0, h = +r.h || 0, area = r.area != null ? +KB.evalExpr(r.area, v) : w * h;
      if (r.key === "maket") { w = +(mk[0] + 2 * (P.gap || 1.2)).toFixed(2); h = +(mk[1] + 2 * (P.gap || 1.2)).toFixed(2); area = w * h; }
      const row = { key: r.key, name: r.name, zone: r.zone, cat: r.cat, n, w, h, area: +area.toFixed(2), border: r.border || "wall", status: r.status || "обязательно", rule: r.rule || "", sub: !!r.sub };
      if (r.color) row.color = r.color;
      if (r.key === "lounge") row.seats = v.seats;
      rows.push(row);
    }
    const net = rows.reduce((s, r) => s + r.n * r.area, 0);
    return { rows, vars: v, maket, net: +net.toFixed(1), need: +(net * (P.k || 1.3)).toFixed(0), k: P.k || 1.3 };
  };

  // Здание под площадь пакета: глубина из пакета, длина из площади (внутри стен 0,3 м)
  KB.suggestBuilding = function (pkgKey, A, pkgDef) {
    const P = pkgDef || KB.PACKAGES[pkgKey]; const d = P.depth || 12, w = +(((+A || P.A) / (d - 0.6)) + 0.6).toFixed(1);
    return { w, d, h: P.h || 4.5 };
  };

  /* ------------------------------------------------------------ программа помещений */
  KB.program = function (p0) {
    if (p0 && p0.pkg) {
      const pp = KB.packageProgram(p0.pkg, p0.area, p0.opts || {}, p0.counts || {}, p0.pkgDef);
      const P = p0.pkgDef || KB.PACKAGES[p0.pkg], v = pp.vars, has = k => pp.rows.some(r => r.key === k);
      const p = Object.assign({}, KB.DEFAULTS, p0, { M: v.M, B: v.B, maket: pp.maket, compact: !!P.compact, gap: P.gap || 1.2, k: P.k,
        kids: has("kids"), cafe: has("cafe"), wardrobe: has("wardrobe"), bank: has("bank"), cashier: has("cashier"), media: has("media"), showroom: has("showroom"), director: has("director") });
      return { params: p, rows: pp.rows, seats: v.seats, staff: v.M + v.B + 1 };
    }
    const p = Object.assign({}, KB.DEFAULTS, p0);
    const M = Math.max(1, Math.round(p.M)), B = Math.max(0, Math.round(p.B));
    const mk = KB.MAKET[p.maket] || KB.MAKET["5x3"];
    const seats = Math.max(6, Math.ceil(1.5 * M));
    const staff = M + B + (p.director ? 1 : 0) + 1; // + хостес
    const R = [];
    const add = (key, name, zone, cat, n, w, h, o = {}) =>
      R.push(Object.assign({ key, name, zone, cat, n, w, h, area: +(w * h).toFixed(2), border: "wall", status: "обязательно", rule: "" }, o));
    add("tambour", "Тамбур", "public", "circ", 1, 2.6, 2.5, { border: "glass", rule: "глубина по ходу ≥ 2,45 м, двери наружу (СП 59)" });
    add("reception", "Ресепшен", "public", "client", 1, 4.4, 2.4, { border: "none", sub: true, rule: "стойка 3 м, видна от входа" });
    add("lounge", "Зона ожидания", "public", "client", 1, 0, 0, { area: +(seats * 1.8).toFixed(1), border: "none", sub: true, seats, rule: `мест max(6; 1,5·M) = ${seats} × 1,8 м²` });
    add("maket", "Зона макета", "public", "client", 1, +(mk[0] + 2.4).toFixed(2), +(mk[1] + 2.4).toFixed(2), { border: "none", sub: true, rule: `стол ${mk[0]}×${mk[1]} + обход 1,2 м` });
    if (p.kids) add("kids", "Детская зона", "public", "client", 1, 3.5, 3.5, { border: "none", sub: true, status: "желательно", color: "#F4D36B", rule: "видна из зоны ожидания, не у входа" });
    if (p.cafe) add("cafe", "Кофе-поинт", "public", "client", 1, 4, 3.2, { border: "none", status: "желательно", color: "#D9B98E", rule: "мокрая точка" });
    if (p.wardrobe) add("wardrobe", "Гардероб посетителей", "public", "client", 1, 2, 3.2, { border: "wall", status: "желательно" });
    if (p.media) add("media", "Медиа / VR зона", "public", "client", 1, 4, 3, { border: "none", sub: true, status: "опция" });
    add("cabinet", "Кабинет менеджера", "semi", "office", M, 3, 3.2, { border: "glass", color: "#9EA3A6", rule: "1 на менеджера, стекло в зал" });
    add("meet", "Переговорная на 6", "semi", "meet", Math.max(1, Math.round(M * 0.2)), 4.5, 3.2, { border: "glass", rule: "max(1; 0,2·M), акустика Rw ≥ 42 дБ" });
    if (p.bank) add("bank", "Ипотека / банк-партнёр", "semi", "office", M > 12 ? 2 : 1, 3, 3.2, { border: "glass" });
    if (p.showroom) add("showroom", "Шоурум отделки", "semi", "client", 1, 5, 3.2, { border: "glass", status: "опция" });
    add("vip", "Сделочная / VIP", "private", "meet", Math.ceil(M / 6), 0, 0, { area: 22, border: "glass", color: "#A8784E", rule: "ceil(M/6), 18–25 м²" });
    if (p.cashier) add("cashier", "Касса", "private", "service", 1, 3, 3, { status: "опция", rule: "усиленная дверь, сейф; при эскроу обычно не нужна" });
    add("wcv", "С/у посетителей", "public", "wc", 1, 0, 0, { area: M >= 6 ? 8.8 : 5, color: "#CFE8E6", rule: "универсальная кабина МГН ≥ 2,20×2,25 (СП 59 табл. 6.1)" });
    add("backoffice", "Бэк-офис open-space", "service", "back", 1, 0, 0, { area: Math.max(12, B * 6), rule: `B × 6 м² (≥ 4,5 м² на место с ПК)` });
    if (p.director) add("director", "Кабинет руководителя", "service", "back", 1, 4, 4.5, { status: "желательно", color: "#A8784E", rule: "18 м² (СП 118 п. 5.31, рекомендация)" });
    add("kitchen", "Кухня / приём пищи", "service", "staff", 1, 0, 0, { area: Math.max(12, staff), rule: `1 м² на человека в смене, ≥ 12 м² (${staff} чел.)` });
    add("wcs", "С/у персонала", "service", "wc", Math.max(1, Math.ceil(staff / 15)), 1.8, 2.5, { color: "#CFE8E6" });
    add("kui", "КУИ", "service", "service", 1, 1.8, 2, { rule: "кладовая уборочного инвентаря, с водой" });
    add("elec", "Электрощитовая", "service", "service", 1, 2, 2.5, { rule: "не под мокрыми помещениями" });
    add("server", "Серверная / архив", "service", "service", 1, 2, 2.5);
    return { params: p, rows: R, seats, staff };
  };

  // Вмещается ли программа: Σ целей × k (коммуникации) против площади внутри наружных стен
  KB.fit = function (p0) {
    const pr = KB.program(p0), p = pr.params;
    const need = pr.rows.reduce((s, r) => s + r.n * r.area, 0), k = p.k || 1.35;
    const mezzOk = p.mezz === "yes" || (p.mezz === "auto" && p.h >= 6.2);
    const inner = (p.w - 0.6) * (p.d - 0.6), have = inner + (mezzOk && p.h - 3.3 >= 2.2 ? Math.min(0.38 * inner, 290) : 0);
    return { need: +(need * k).toFixed(0), net: +need.toFixed(0), have: +have.toFixed(0), k, ratio: +(have / (need * k)).toFixed(2), mezz: mezzOk };
  };

  /* ------------------------------------------------------------ утилиты модели планировщика */
  let _n = 0;
  const uid = () => "g" + (++_n).toString(36) + Math.random().toString(36).slice(2, 7);
  const r3 = v => Math.round(v * 1000) / 1000;
  function room(name, x, y, w, h, cat, border, o = {}) {
    return Object.assign({ id: uid(), t: "room", lv: 0, name, x: r3(x), y: r3(y), w: r3(w), h: r3(h), cat, border, color: KB.CAT[cat].c, sub: false, ph: 3 }, o);
  }
  function furn(k, x, y, rot = 0, o = {}) {
    const d = DIMS[k] || [1, 1];
    return Object.assign({ id: uid(), t: "item", lv: 0, k, x: r3(x), y: r3(y), w: d[0], h: d[1], rot, flip: false, label: "" }, o);
  }
  // Дверь на стороне помещения: side n|s|e|w, off — от левого/верхнего угла, inward — открывается внутрь
  function door(r, side, off, w = 0.9, inward = true, o = {}) {
    const k = w >= 1.6 ? "door18" : "door9", h = k === "door18" ? w / 2 + 0.3 : w + 0.3, t = 0.15;
    let x, y, rot;
    if (side === "s") { const ey = r.y + r.h; rot = inward ? 180 : 0; x = r.x + off; y = inward ? ey + t - h : ey - t; }
    if (side === "n") { const ey = r.y; rot = inward ? 0 : 180; x = r.x + off; y = inward ? ey - t : ey + t - h; }
    if (side === "w") { const ex = r.x; rot = inward ? 270 : 90; y = r.y + off; x = inward ? ex - t : ex + t - h; }
    if (side === "e") { const ex = r.x + r.w; rot = inward ? 90 : 270; y = r.y + off; x = inward ? ex + t - h : ex - t; }
    return Object.assign({ id: uid(), t: "item", lv: r.lv || 0, k, x: r3(x), y: r3(y), w, h: r3(h), rot, flip: false, label: "" }, o);
  }
  const center = (r, w, h) => [r.x + (r.w - w) / 2, r.y + (r.h - h) / 2];

  /* ------------------------------------------------------------ генератор планировки */
  KB.generate = function (p0) {
    const prog = KB.program(p0), p = prog.params, rows = prog.rows, warn = [];
    const W = +p.w, D = +p.d, H = +p.h, t = 0.3;
    const x0 = t, x1 = W - t, y0 = t, y1 = D - t, Din = y1 - y0, Lin = x1 - x0;
    const get = k => rows.find(r => r.key === k);
    let mezz = p.mezz === "yes" || (p.mezz === "auto" && H >= 6.2);
    const mz = 3.3;
    if (mezz && H - mz < 2.2) { warn.push(`Антресоль не помещается по высоте: над ней остаётся ${(H - mz).toFixed(2)} м < 2,2 м. Антресоль отключена.`); mezz = false; }
    const I = [], unplaced = [];
    const sum = a => a.reduce((s, r) => s + r.w, 0);
    // Схема: задний ряд (глубина 3,2) вдоль глухой стены — сквозной: [кофе, гардероб, кабинеты, переговорные …] … [лестница, с/у, КУИ, щитовая].
    // Проход 1,8 вдоль ряда — главная коммуникация. Передний ряд у витража в правом торце — сервисный блок: VIP, кухня, (бэк-офис).
    // Остальная полоса у витража — публичная: детская, ожидание, макет, вход с ресепшен.
    const cabR = get("cabinet"), openDesks = !!(cabR && cabR.border === "none"), gap = p.gap || 1.2;
    const baseRow = cabR && !openDesks ? cabR.h : (p.compact ? 2.6 : 3.2);
    const shallow = D < 11, rowD = shallow ? Math.min(3.0, baseRow) : baseRow, aisle = shallow ? 1.5 : 1.8, yA = y0 + rowD + aisle, df = y1 - yA;
    const deep = df >= 8.6; // глубокий зал: второй ряд кабинетов и две полосы у витража
    const dfS = df > 7.4 ? 6.2 : df; // глубина сервисного блока; при глубоком здании зал продолжается вдоль витража
    if (df < (p.compact ? 3.6 : 4.5)) warn.push(`Глубина здания мала для схемы с проходом: у витража остаётся ${df.toFixed(1)} м.`);
    const mk0 = (k, w, extra = {}) => { const pr = get(k); w = pr.w || w; return Object.assign({ key: k, name: pr.name, cat: pr.cat, border: pr.border, color: pr.color, w, w0: w }, extra); };
    const KNOWN = new Set(["tambour", "reception", "lounge", "maket", "kids", "cafe", "wardrobe", "media", "cabinet", "meet", "bank", "showroom", "vip", "cashier", "wcv", "wcs", "backoffice", "director", "kitchen", "kui", "elec", "server"]);
    // задний ряд: клиентская часть
    let hallRow = [];
    if (get("cafe")) hallRow.push(mk0("cafe", 4));
    if (get("wardrobe")) hallRow.push(mk0("wardrobe", 2));
    if (cabR) for (let i = 0; i < cabR.n; i++) hallRow.push(mk0("cabinet", 3));
    if (get("meet")) for (let i = 0; i < get("meet").n; i++) hallRow.push(mk0("meet", 4.5));
    for (const r of rows) if (!KNOWN.has(r.key) && (r.zone === "semi" || r.zone === "private") && !r.sub) for (let i = 0; i < r.n; i++) hallRow.push({ key: r.key, name: r.name, cat: r.cat, border: r.border, color: r.color, w: r.w || Math.max(2.4, r.area / rowD), w0: r.w || 3 });
    if (get("bank")) for (let i = 0; i < get("bank").n; i++) hallRow.push(mk0("bank", 3));
    if (get("showroom")) hallRow.push(mk0("showroom", 5));
    // задний ряд: служебная часть в правом торце; лестница — у торца, чтобы антресоль была компактной
    const wcv = get("wcv"), wcs = get("wcs");
    const svcRow = [];
    const pw = (r, def) => p.pkg ? Math.max(r.w && r.h ? r.w * r.h / rowD : 0, r.w || 0, Math.min(def, 1.0)) : def;
    if (wcv) svcRow.push({ key: "wcv", name: wcv.name, cat: "wc", border: "wall", w: p.pkg ? Math.max(2.4, wcv.area / rowD) : (p.M >= 6 ? 3.9 : 2.4), color: wcv.color });
    if (wcs) for (let i = 0; i < wcs.n; i++) svcRow.push({ key: "wcs", name: wcs.name, cat: "wc", border: "wall", w: p.pkg ? Math.max(1.5, wcs.w * wcs.h / rowD) : 1.8, color: wcs.color });
    const kuiR = get("kui"), elecR = get("elec"), servR = get("server");
    if (kuiR) svcRow.push({ key: "kui", name: kuiR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.0, kuiR.area / rowD) : 1.8 });
    if (elecR) svcRow.push({ key: "elec", name: elecR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.2, elecR.area / rowD) : 2.0 });
    if (!mezz && servR) svcRow.push({ key: "server", name: servR.name, cat: "service", border: "wall", w: p.pkg ? Math.max(1.5, servR.area / rowD) : 2.0 });
    for (const r of rows) if (!KNOWN.has(r.key) && r.zone === "service" && !r.sub) for (let i = 0; i < r.n; i++) svcRow.push({ key: r.key, name: r.name, cat: r.cat, border: r.border, color: r.color, w: Math.max(1.5, r.area / rowD) });
    if (mezz) svcRow.push({ key: "stair", name: "Лестничная клетка", cat: "circ", border: "none", w: 2.8 });
    // передний ряд у витража в правом торце
    const vip = get("vip"), kit = get("kitchen"), bo = get("backoffice"), dir = get("director"), cash = get("cashier");
    const front = [];
    if (vip) for (let i = 0; i < vip.n; i++) front.push({ key: "vip", name: vip.name, cat: "meet", border: "glass", w: Math.max(p.pkg ? 3.0 : 4.2, vip.area / dfS), color: vip.color });
    if (cash) front.push({ key: "cashier", name: "Касса", cat: "service", border: "wall", w: Math.max(2.4, 9 / dfS) });
    if (p.compact) {   // маленький офис: всё служебное — в задний ряд, у витража только сделочная
      if (kit) svcRow.splice(1, 0, { key: "kitchen", name: kit.name, cat: "staff", border: "wall", w: Math.max(2.0, kit.area / rowD) });
      if (bo) svcRow.splice(2, 0, { key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Math.max(2.0, bo.area / rowD) });
      if (dir) svcRow.splice(2, 0, { key: "director", name: dir.name, cat: "back", border: "wall", w: Math.max(3.0, dir.area / rowD), color: dir.color });
    } else {
      if (kit) front.push({ key: "kitchen", name: kit.name, cat: "staff", border: "wall", w: Math.max(2.6, kit.area / dfS) });
      if (!mezz) {
        if (dir) front.push({ key: "director", name: dir.name, cat: "back", border: "wall", w: Math.max(3.2, (dir.area || 18) / dfS), color: dir.color });
        if (bo) front.push({ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Math.max(3, bo.area / dfS) });
      }
    }
    const mkS = KB.MAKET[p.maket] || KB.MAKET["5x3"];
    const needPublic = (get("kids") ? 4.0 : 0) + (get("cafe") ? 4.4 : 0) + mkS[0] + 2 * gap + 1.2 + 4.8 + Math.min(Math.ceil((get("lounge") ? get("lounge").seats : 6) / 5), 2) * 2.8;
    const pubMin = Math.max(needPublic, 0.45 * Lin);
    const canRow2 = df >= 7.8;
    // переполнение заднего ряда: кабинеты — во второй ряд (остров), переговорные и ипотека — к VIP или во второй ряд,
    // кофе-поинт — в публичную зону, остальное — «не размещено»
    const row2 = []; let cafePublic = false, deskHall = 0;
    const over = () => sum(hallRow) + sum(svcRow) - Lin;
    const takeLast = k => { const i = hallRow.map(r => r.key).lastIndexOf(k); return i < 0 ? null : hallRow.splice(i, 1)[0]; };
    for (const k of ["cafe", "wardrobe", "bank", "showroom", "meet", "cabinet"]) {
      while (over() > 1e-6) {
        const it = takeLast(k); if (!it) break;
        if (k === "cafe") { cafePublic = true; continue; }
        if (k === "cabinet" && openDesks) { deskHall++; continue; }
        const fw = Math.max(k === "bank" ? 2.6 : 3.4, (it.w * rowD) / dfS);
        if ((k === "bank" || k === "meet") && (dfS < df || (x1 - sum(front) - fw) - x0 >= pubMin)) { it.w = fw; front.splice(vip.n, 0, it); continue; }
        if (canRow2) { row2.push(it); continue; }
        unplaced.push(it.name);
      }
    }
    // освободившееся место в заднем ряду — обратно помещениям (сначала «не размещённые», потом перенесённые к витражу)
    { const back = [...unplaced.map(n => ({ n })), ...front.filter(f => f.w0).map(f => ({ f }))];
      for (const c of back) { const gap = Lin - sum(hallRow) - sum(svcRow);
        const key = c.f ? c.f.key : rows.find(r => r.name === c.n)?.key; if (!key) continue;
        const w0 = { cabinet: 3, meet: 4.5, bank: 3, showroom: 5, wardrobe: 2, cafe: 4 }[key]; if (!w0 || w0 > gap + 1e-6) continue;
        if (c.f) front.splice(front.indexOf(c.f), 1); else unplaced.splice(unplaced.indexOf(c.n), 1);
        const it = mk0(key, w0); const at = hallRow.map(r => r.key).lastIndexOf(key); hallRow.splice(at < 0 ? hallRow.length : at + 1, 0, it); } }
    const Lf = sum(front), xs = x1 - Lf;             // левая граница сервисного блока у витража
    const xP = dfS < df ? x1 : x1 - sum(front);        // правая граница публичной полосы у витража
    // ---- упаковка публичной полосы у витража: [детская] [ожидание…] [макет] [вход + ресепшен] [ожидание…] [кофе]
    const yP0 = row2.length ? yA + rowD : yA, bandD = y1 - yP0;
    const kidR0 = get("kids"), cafR = get("cafe"), tamR = get("tambour"), recR = get("reception");
    let kw = kidR0 ? Math.max(2, kidR0.w || 3.5) : 0, kh = kidR0 ? Math.max(2, kidR0.h || 3.5) : 0;
    const cw = cafR ? Math.max(2.4, Math.min(4.4, cafR.w || 4)) : 0, ch = cafR ? Math.min(3.5, Math.max(2, cafR.h || 3.5)) : 0;
    const tw = tamR ? Math.max(2.2, tamR.w || 2.6) : 0, th = tamR ? Math.max(2.2, tamR.h || 2.5) : 0;
    const rw = recR ? (recR.w || 4.4) : 0, rh = recR ? (recR.h || 2.4) : 0;
    const beside = !!recR && (p.compact || bandD < th + 1.2 + rh + 0.2);   // ресепшен рядом со входом, если глубины мало
    const eW = beside ? Math.max(tw, 1.4) + 0.3 + rw : Math.max(tw, rw, 3);
    const small = p.compact ? KB.MAKET["2x1.5"] : KB.MAKET["3x2"];
    let mk = mkS, mw = mk[0] + 2 * gap, mh = mk[1] + 2 * gap, useKids = !!kidR0, useCafe = !!(cafR && cafePublic), useMaket = !!get("maket");
    const lounge = get("lounge") || { seats: 0 }, per = p.compact ? 3 : 5, groups = Math.ceil(lounge.seats / per), gw = 2.2, gh = p.compact ? 1.8 : 2.9;
    const innerOK = () => bandD >= (p.compact ? gh + 0.6 : 3.5) + 1.0 + mh + 0.3;
    if (useMaket && !innerOK() && mh + 0.6 > bandD) { if (mk !== small) { mk = small; mw = mk[0] + 2 * gap; mh = mk[1] + 2 * gap; warn.push(`Стол макета уменьшен до ${mk[0]}×${mk[1]}: не хватает глубины зала.`); } if (mh + 0.6 > bandD) { useMaket = false; warn.push("Зона макета не помещается по глубине зала — поставьте экран или уменьшите макет."); } }
    let inner = useMaket && innerOK();
    const L = xP - x0 - 0.6, G = 0.6;
    const minL = groups > 0 ? gw + G : 0;   // хотя бы одна мягкая зона у витража
    const seqW = () => minL + (useKids ? kw + G : 0) + (useMaket && !inner ? mw + G : 0) + eW + (useCafe ? cw + G : 0);
    if (seqW() > L && useCafe) { useCafe = false; unplaced.push(cafR.name); }
    if (seqW() > L && useKids) { useKids = false; unplaced.push(kidR0.name); }
    if (seqW() > L && useMaket && !inner && mk !== small) { mk = small; mw = mk[0] + 2 * gap; mh = mk[1] + 2 * gap; inner = innerOK(); warn.push(`Стол макета уменьшен до ${mk[0]}×${mk[1]}: не хватает длины витрины.`); }
    if (seqW() > L && useMaket && !inner) { useMaket = false; warn.push("Зона макета не помещается вдоль витрины — поставьте экран или увеличьте длину здания."); }
    let freeW = L - seqW() + minL; const nL = Math.max(0, Math.min(groups, Math.floor(freeW / (gw + G))));
    freeW -= nL * (gw + G);
    const seq = [];
    if (useKids) seq.push({ t: "kids", w: kw });
    for (let i = 0; i < Math.ceil(nL / 2); i++) seq.push({ t: "lounge", w: gw });
    if (useMaket && !inner) seq.push({ t: "maket", w: mw });
    seq.push({ t: "ent", w: eW });
    for (let i = 0; i < Math.floor(nL / 2); i++) seq.push({ t: "lounge", w: gw });
    if (useCafe) seq.push({ t: "cafe", w: cw });
    const extra = seq.length > 1 ? freeW / (seq.length - 1) : 0;
    { let x = x0 + 0.3 + (seq.length > 1 ? 0 : freeW / 2); for (const it of seq) { it.x = x; x += it.w + G + extra; } }
    const ent = seq.find(it => it.t === "ent");
    let cE = beside ? ent.x + Math.max(tw, 1.4) / 2 : ent.x + eW / 2;
    { // дверь не должна попасть на колонну витража (шаг 5 м): сдвиг блока входа в пределах соседних зазоров
      const i = seq.indexOf(ent), lo = i > 0 ? seq[i - 1].x + seq[i - 1].w + 0.3 : x0 + 0.3, hi = i < seq.length - 1 ? seq[i + 1].x - 0.3 : xP - 0.3;
      const dw = tw && tw < 2.6 ? 1.2 : 1.8, ok = c => { for (let k = 0; k * 5 <= W; k++) if (Math.abs(c - k * 5) < dw / 2 + 0.25) return false; return true; };
      for (let d = 0; d <= 2.5; d += 0.05) { let hit = false; for (const s of [d, -d]) { const nx = ent.x + s, nc = cE + s; if (nx >= lo - 1e-6 && nx + eW <= hi + 1e-6 && ok(nc)) { ent.x = nx; cE = nc; hit = true; break; } } if (hit) break; } }
    // второй ряд — два острова по сторонам от оси входа, проход 2,4 м к ресепшен
    const segs = [[x0 + 0.6, Math.min(cE - 2.6, xs - 0.6)], [cE + 2.6, xs - 0.6]].filter(g => g[1] - g[0] >= 2.6), R2items = [];
    { let si = 0, cx = segs.length ? segs[0][0] : 0;
      for (const it of row2) { while (si < segs.length && cx + it.w > segs[si][1] + 1e-6) { si++; if (si < segs.length) cx = segs[si][0]; }
        if (si >= segs.length) { unplaced.push(it.name); continue; } R2items.push([it, cx]); cx += it.w; } }
    if (unplaced.length) warn.push(`Не поместились: ${unplaced.join(", ")}. Увеличьте длину здания или уменьшите программу.`);
    const place = (row, x, y, h, lv = 0) => row.map(it => { const r = room(it.name, x, y, it.w, h, it.cat, it.border, { lv, color: it.color || KB.CAT[it.cat].c }); r._key = it.key; x += it.w; I.push(r); return r; });
    const HR = place(hallRow, x0, y0, rowD);
    const svcX = x1 - sum(svcRow);
    const SR = place(svcRow, svcX, y0, rowD);
    const FR = place(front, xs, yA, dfS);
    if (dfS < df) I.push(room("Зал продаж (у витража)", xs, yA + dfS, x1 - xs, df - dfS, "client", "none", { color: "#EDE8DE" }));
    const R2 = R2items.map(([it, cx]) => place([it], cx, yA, rowD)[0]);
    const yP = R2.length ? yA + rowD : yA;            // начало публичной зоны
    for (const r of R2) { const k = r._key;
      if (k === "cabinet" || k === "bank") { I.push(furn("work3", r.x + r.w / 2 - 0.8, r.y + 0.5, 180)); I.push(furn("slide", r.x + 0.3, r.y - 0.15)); }
      else if (k === "meet") { I.push(furn("meet6", r.x + (r.w - 2.4) / 2, r.y + 0.75)); I.push(door(r, "n", 0.3, 0.9, true)); }
      else I.push(door(r, "n", 0.3, 0.9, true)); }
    const hall = room("Зал продаж", x0, yA, xs - x0, df, "client", "none", { color: "#EDE8DE" });
    I.unshift(hall);
    const endHall = HR.length ? HR[HR.length - 1].x + HR[HR.length - 1].w : x0;
    if (svcX - endHall > 0.3) I.push(room("Проход", endHall, y0, svcX - endHall, rowD, "circ", "none", { color: "#EDE8DE" }));
    I.push(room("Проход вдоль кабинетов", x0, y0 + rowD, xs - x0, aisle, "circ", "none", { color: "#EDE8DE" }));
    I.push(room("Коридор", xs, y0 + rowD, Lf, aisle, "circ", "none"));

    // наполнение заднего ряда
    for (const r of HR) { const k = r._key, x = r.x, w = r.w;
      if (k === "cabinet" && openDesks) { r.sub = false; I.push(furn("work3", x + w / 2 - 0.8, y0 + Math.max(0.1, (rowD - 2.3) / 2))); }
      else if (k === "cabinet" || k === "bank") { I.push(furn("work3", x + w / 2 - 0.8, y0 + 0.4)); I.push(furn("slide", x + 0.3, y0 + rowD - 0.15)); }
      if (k === "meet") { I.push(furn("meet6", x + (w - 2.4) / 2, y0 + 0.35)); I.push(door(r, "s", 0.3, 0.9, true)); }
      if (k === "showroom") { I.push(furn("stand", x + 0.4, y0 + 0.2, 0, { w: w - 0.8 })); I.push(door(r, "s", 0.3, 0.9, true)); }
      if (k === "wardrobe") { I.push(furn("shelf", x + 0.1, y0 + 0.2, 90, { w: 2.6 })); }
      if (k === "cafe") { I.push(furn("kitch", x, y0, 0, { w: 4 })); I.push(furn("bar", x + 0.5, y0 + 1.5, 0, { w: 3.5 })); for (let i = 0; i < 4; i++) I.push(furn("stool", x + 0.9 + i * 0.8, y0 + 2.3)); }
    }
    for (const r of SR) { const k = r._key;
      if (k === "stair") { I.push(furn("stair2", r.x + 0.1, r.y, 0, { h: Math.min(4, rowD + aisle - 0.2) })); continue; }
      I.push(door(r, "s", 0.2, k === "wcv" ? 1.0 : 0.8, false));
      if (k === "wcv") { I.push(furn("wc", r.x + 1.0, r.y + 0.1)); I.push(furn("sink", r.x + 1.7, r.y + 1.4, 90)); if (r.w >= 3.5) { I.push(furn("cubicle", r.x + r.w - 1.35, r.y + 0.05)); I.push(furn("wc", r.x + r.w - 0.95, r.y + 0.1)); } }
      if (k === "wcs") { I.push(furn("wc", r.x + 0.7, r.y + 0.1)); I.push(furn("sink", r.x + r.w - 0.6, r.y + 1.3, 90)); }
      if (k === "kui" || k === "server") I.push(furn("shelf", r.x + 0.1, r.y + 0.1, 0, { w: Math.min(1.6, r.w - 0.2) }));
    }
    for (const r of FR) { const k = r._key;
      if (k === "vip" || k === "meet" || k === "bank" || k === "showroom") {
        if (r === FR[0]) I.push(door(r, "w", 0.4, 0.9, true)); else I.push(door(r, "n", 0.3, 0.9, true));
        if (k === "vip" || k === "meet") { const t8 = k === "vip" && r.w >= 4.0 ? "meet8" : "meet6"; const [cx, cy] = center(r, DIMS[t8][0], DIMS[t8][1]); I.push(furn(t8, cx, cy)); }
        if (k === "bank") I.push(furn("work3", r.x + r.w / 2 - 0.8, r.y + 1.0, 180));
        continue; }
      I.push(door(r, "n", 0.3, k === "cashier" ? 1.0 : 0.9, true));
      if (k === "kitchen") { I.push(furn("kitch", r.x + r.w - 0.6, r.y + 1.1, 90, { w: Math.min(2.4, r.h - 1.5) })); if (r.w >= 3.2) I.push(furn("dine", r.x + 0.3, r.y + r.h - 2.3)); else I.push(furn("desk", r.x + 0.2, r.y + r.h - 1.0, 0, { w: Math.min(1.6, r.w - 0.8), label: "стол" })); I.push(furn("fridge", r.x + r.w - 0.75, r.y + r.h - 0.8)); }
      if (k === "cashier") { I.push(furn("desk", r.x + 0.2, r.y + r.h - 1.0, 0, { w: Math.min(1.6, r.w - 0.4) })); I.push(furn("safe", r.x + r.w - 0.6, r.y + r.h - 0.6)); }
      if (k === "director") { const [cx, cy] = center(r, 1.8, 0.9); I.push(furn("deskB", cx, cy)); I.push(furn("chairO", cx + 0.6, cy + 1.0, 180)); I.push(furn("chairV", cx + 0.3, cy - 0.7)); I.push(furn("chairV", cx + 1.0, cy - 0.7)); }
      if (k === "backoffice") fillOpen(r);
    }
    function fillOpen(r) {
      let need = Math.max(1, Math.ceil(p.B / 4)), placed = 0;
      for (let y = r.y + 0.6; y + 2.6 <= r.y + r.h - 0.3 && placed < need; y += 3.6)
        for (let x = r.x + 0.5; x + 2.8 <= r.x + r.w - 0.3 && placed < need; x += 3.8) { I.push(furn("os4", x, y, 0, { lv: r.lv })); placed++; }
      let seats = placed * 4;
      for (let y = r.y + 0.4; y + 1.3 <= r.y + r.h - 0.2 && seats < p.B; y += 1.9)
        for (let x = r.x + 0.3; x + 1.4 <= r.x + r.w - 0.2 && seats < p.B; x += 1.6) { if (placed && y < r.y + 0.6 + Math.ceil(placed / Math.max(1, Math.floor((r.w - 0.8) / 3.8))) * 3.6) continue; I.push(furn("os1", x, y, 0, { lv: r.lv })); seats++; }
      if (seats < p.B) warn.push(`В бэк-офисе помещается ${seats} мест из ${p.B}.`);
    }
    I.push(door({ x: x1 - 0.001, y: y0 + rowD, w: 0.001, h: aisle, lv: 0 }, "e", 0.35, 1.1, false, { label: "Служебный вход" }));

    // публичная полоса у витража (позиции из упаковки выше)
    const dW = tw && tw < 2.6 ? 1.2 : 1.8;
    if (tamR) { I.push(room(tamR.name, cE - tw / 2, y1 - th, tw, th, "circ", "glass", { sub: true }));
      I.push(door({ x: cE - dW / 2, y: y1 - th, w: dW, h: 0.001 }, "n", 0, dW, true)); }
    I.push(door({ x: cE - dW / 2, y: y1, w: dW, h: 0.001 }, "n", 0, dW, true));
    const recX = beside ? ent.x + Math.max(tw, 1.4) + 0.3 : cE - rw / 2;
    const recY = beside ? y1 - rh - 0.4 : Math.max(yP + 0.2, y1 - th - 1.5 - rh);
    if (recR) {
      if (!beside && y1 - th - (recY + rh) < 1.2) warn.push("Мало места между тамбуром и ресепшен (зона «декомпрессии» < 1,2 м).");
      I.push(room(recR.name, recX, recY, rw, rh, "client", "none", { sub: true }));
      if (beside) { I.push(furn("recep", recX + 0.2, recY + 0.2, 90, { w: Math.min(1.4, rh - 0.3) })); I.push(furn("chairO", recX + 1.2, recY + 0.4)); }
      else { const dk = Math.min(3, rw - 0.8); I.push(furn("recep", cE - dk / 2, recY + rh - 1.1, 180, { w: dk })); I.push(furn("chairO", cE - 0.3, recY + 0.3)); } }
    let placedG = 0;
    const putLounge = (x, y) => { if (p.compact) { I.push(furn("sofa3", x, y + gh - 0.9, 180)); I.push(furn("ctab", x + 0.5, y)); } else I.push(furn("lounge", x, y)); };
    for (const it of seq) {
      if (it.t === "kids") { I.push(room(kidR0.name, it.x, y1 - kh, kw, kh, "client", "none", { sub: true, color: "#F4D36B" })); I.push(furn("kidmat", it.x + 0.2, y1 - Math.min(1.6, kh - 0.4) - 0.2, 0, { w: Math.min(1.8, kw - 0.4), h: Math.min(1.6, kh - 0.4) })); if (kw >= 3) I.push(furn("kidtab", it.x + kw - 1.3, y1 - kh + 0.2)); }
      if (it.t === "cafe") { I.push(room(cafR.name, it.x, y1 - ch, cw, ch, "client", "none", { sub: true, color: "#D9B98E" })); I.push(furn("bar", it.x + 0.2, y1 - ch + 0.2, 0, { w: cw - 0.4 })); if (ch >= 3) I.push(furn("cafe4", it.x + cw / 2 - 0.95, y1 - 2.2)); }
      if (it.t === "maket") { const my = y1 - 0.6 - mh; I.push(room("Зона макета", it.x, my, mw, mh, "client", "none", { sub: true, color: "#F2F0EA" })); I.push(furn("model", it.x + gap, my + gap, 0, { w: mk[0], h: mk[1] })); }
      if (it.t === "lounge") { putLounge(it.x, y1 - 0.4 - gh); I.push(room(lounge.name || "Зона ожидания", it.x - 0.2, y1 - gh - 0.6, gw + 0.4, gh + 0.6, "client", "none", { sub: true, color: "#F3E6CF" })); placedG++; }
    }
    if (inner) { // макет в глубине зала: у витража остаётся полоса ожидания; сторона — где больше места от ресепшен
      const my = y1 - (p.compact ? gh + 0.6 : 3.5) - 1.0 - mh, rL = recX, rR = recX + rw;
      const leftX = rL - 0.8 - mw, rightX = rR + 0.8, fitsX = x => x >= x0 + 0.3 && x + mw <= xP - 0.3;
      let mx = my + mh < recY - 0.2 ? Math.max(x0 + 0.3, Math.min(cE - mw / 2, xP - 0.3 - mw)) : (fitsX(leftX) && (!fitsX(rightX) || cE - x0 > xP - cE) ? leftX : (fitsX(rightX) ? rightX : Math.max(x0 + 0.3, leftX)));
      I.push(room("Зона макета", mx, my, mw, mh, "client", "none", { sub: true, color: "#F2F0EA" })); I.push(furn("model", mx + gap, my + gap, 0, { w: mk[0], h: mk[1] })); }
    if (placedG < groups) { // остальные мягкие зоны — в свободных местах зала
      const occ = I.filter(i => (i.lv || 0) === 0 && (i.t === "item" || (i.t === "room" && i.name !== "Зал продаж"))).map(i => { const q = (i.rot || 0) % 180 ? [i.h, i.w] : [i.w, i.h]; return [i.x, i.y, q[0], q[1]]; });
      const hit = (x, y, w, h, m) => occ.some(([a, b, c, d]) => x < a + c + m && x + w + m > a && y < b + d + m && y + h + m > b);
      for (let y = y1 - 0.4 - gh; y >= yP + 0.3 && placedG < groups; y -= 0.4)
        for (let x = x0 + 0.4; x + gw <= xP - 0.4 && placedG < groups; x += 0.4) {
          if (x + 2.2 > cE - 1.6 && x < cE + 1.6) continue;           // ось входа свободна
          if (hit(x, y, gw, gh, p.compact ? 0.4 : 0.5)) continue;
          putLounge(x, y); I.push(room(lounge.name || "Зона ожидания", x - 0.2, y - 0.2, gw + 0.4, gh + 0.4, "client", "none", { sub: true, color: "#F3E6CF" }));
          occ.push([x, y, gw, gh]); placedG++; }
    }
    if (placedG < groups) warn.push(`Мягких зон в зале: ${placedG} из ${groups} (мест ${placedG * per} из ${lounge.seats}).`);
    if (openDesks && deskHall) { // открытые места консультаций, не поместившиеся вдоль стены — в свободных местах зала, ближе к проходу
      const occ = I.filter(i => (i.lv || 0) === 0 && (i.t === "item" || (i.t === "room" && !/Зал продаж|Проход/.test(i.name)))).map(i => { const q = (i.rot || 0) % 180 ? [i.h, i.w] : [i.w, i.h]; return [i.x, i.y, q[0], q[1]]; });
      const hit = (x, y, w, h, m) => occ.some(([a, b, c, d]) => x < a + c + m && x + w + m > a && y < b + d + m && y + h + m > b);
      const dw = cabR.w || 2.8, dh = cabR.h || 2.6, needD = deskHall; let placedD = 0;
      for (let y = yA + 0.1; y + dh <= y1 - 0.3 && placedD < needD; y += 0.4)
        for (let x = x0 + 0.3; x + dw <= xP - 0.3 && placedD < needD; x += 0.4) {
          if (x + dw > cE - 1.2 && x < cE + 1.2 && y + dh > recY - 0.5) continue;
          if (hit(x, y, dw, dh, p.compact ? 0.3 : 0.5)) continue;
          I.push(room(cabR.name, x, y, dw, dh, cabR.cat, "none", { sub: true, color: cabR.color || KB.CAT[cabR.cat].c }));
          I.push(furn("work3", x + dw / 2 - 0.8, y + Math.max(0.1, (dh - 2.3) / 2)));
          occ.push([x, y, dw, dh]); placedD++; }
      if (placedD < needD) warn.push(`Мест консультации: не поместилось ${needD - placedD} из ${cabR.n}.`);
    }
    if (get("media")) { I.push(room("Медиа / VR зона", x0, yP + 0.2, 3, Math.max(2, Math.min(4, y1 - 3.7 - yP)), "client", "none", { sub: true })); I.push(furn("led", x0, yP + 0.8, 90)); }
    I.push(furn("plant", x0 + 0.1, yA + 0.1)); I.push(furn("plant", xP - 0.8, y1 - 0.8)); I.push(furn("cooler", xs - 0.5, yA + 0.2));

    // антресоль над правым торцом: над сервисным блоком и служебной частью заднего ряда
    let mA = 0;
    if (mezz) {
      const inner = Lin * Din, cap = Math.min(0.38 * inner, 290) / Din;
      const stairX = x1 - 2.8, L1 = { lv: 1 }, xm = Math.min(stairX - 3.2, Math.max(Math.min(xs, svcX), x1 - cap)), Lm = x1 - xm;
      mA = Lm * (rowD + aisle + dfS);
      if (mA / inner > 0.4) warn.push(`Антресоль ${Math.round(mA / inner * 100)}% площади — больше 40%, проектировщик может посчитать её этажом.`);
      // задний ряд антресоли: [до лестницы: кабинет руководителя / архив] [площадка лестницы] [после: серверная / архив]
      const mb = []; const before = stairX - xm, after = x1 - (stairX + 2.8);
      if (before >= 3) mb.push({ key: dir ? "director" : "server", name: dir ? dir.name : "Серверная / архив", cat: dir ? "back" : "service", border: "wall", w: before, color: dir ? dir.color : null });
      else if (before > 0.05) mb.push({ key: "void", name: "Проход", cat: "circ", border: "none", w: before });
      mb.push({ key: "pad", name: "Площадка лестницы", cat: "circ", border: "none", w: 2.8 });
      if (after >= 1.5) mb.push({ key: dir && before < 3 ? "director" : "server", name: dir && before < 3 ? dir.name : "Серверная / архив", cat: dir && before < 3 ? "back" : "service", border: "wall", w: after, color: dir && before < 3 ? dir.color : null });
      const MB = place(mb, xm, y0, rowD, 1);
      I.push(room("Холл-галерея", xm, y0 + rowD, Lm, aisle, "circ", "none", L1));
      const hasServer = mb.some(r => r.key === "server");
      const MF = place(hasServer || Lm < 6 ? [{ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Lm }]
        : [{ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Lm - 2.0 }, { key: "server", name: "Серверная / архив", cat: "service", border: "wall", w: 2.0 }], xm, yA, dfS, 1);
      I.push(furn("stair2", stairX + 0.1, y0, 0, Object.assign({ label: "проём", h: Math.min(4, rowD + aisle - 0.2) }, L1)));
      I.push({ id: uid(), t: "wall", lv: 1, kind: "rail", x1: xm, y1: y0 + rowD, x2: xm, y2: yA, th: 0.05 });
      if (MB[0] && MB[0]._key === "void") I.push({ id: uid(), t: "wall", lv: 1, kind: "rail", x1: xm, y1: y0, x2: xm, y2: y0 + rowD, th: 0.05 });
      for (const r of MB) { if (r._key === "pad" || r._key === "void") continue; I.push(door(r, "s", 0.3, r._key === "server" ? 0.8 : 0.9, true));
        if (r._key === "director") { const [cx, cy] = center(r, 1.8, 0.9); I.push(furn("deskB", cx, cy, 0, L1)); I.push(furn("chairO", cx + 0.6, cy - 0.7, 0, L1)); }
        if (r._key === "server") I.push(furn("shelf", r.x + 0.1, r.y + 0.1, 0, Object.assign({ w: Math.min(1.8, r.w - 0.2) }, L1))); }
      for (const r of MF) { I.push(door(r, "n", 0.3, r._key === "server" ? 0.8 : 0.9, true)); if (r._key === "backoffice") fillOpen(r); else I.push(furn("shelf", r.x + 0.1, r.y + r.h - 0.5, 0, Object.assign({ w: 1.8 }, L1))); }
      if ((Lm - (hasServer ? 0 : 2)) * dfS < bo.area * 0.95) warn.push(`Бэк-офис на антресоли ${(Lm * dfS).toFixed(0)} м² меньше цели ${bo.area} м².`);
    }

    const project = {
      v: 1, name: p.name || "Офис продаж", notes: "", b: { w: W, d: D, h: H, mz: mz, front: p.front || "vitrage" },
      items: I.map(({ _key, ...it }) => it),
      program: rows.map(r => ({ key: r.key, name: r.name, zone: r.zone, cat: r.cat, n: r.n, area: r.area, status: r.status, rule: r.rule, sub: !!r.sub })),
      meta: { generator: "office-kb " + KB.version, params: p, mezz, warnings: warn },
    };
    return { project, warnings: warn, program: rows, mezz };
  };

  /* ------------------------------------------------------------ программа: цель / факт */
  const norm = s => String(s || "").toLowerCase().replace(/ё/g, "е");
  const MATCH = {
    tambour: ["тамбур"], reception: ["ресепшен", "хостес"], lounge: ["ожидан", "лаунж"], maket: ["макет"], kids: ["детск"],
    cafe: ["кофе", "бар", "кафе"], wardrobe: ["гардероб"], media: ["медиа", "vr"], cabinet: ["кабинет менеджер", "место консультац"], meet: ["переговорн"],
    bank: ["ипотек", "банк"], showroom: ["шоурум"], vip: ["сделочн", "vip"], archive: ["архив"], storage: ["склад"], security: ["охран"], cashier: ["касса"], wcv: ["с/у посетит", "с/у мгн", "санузел посетит", "санузел универсал"], stair: ["лестнич"],
    backoffice: ["бэк-офис", "бэк офис", "back"], director: ["руководител", "роп"], kitchen: ["кухн", "приём пищи", "прием пищи", "отдыха"],
    wcs: ["с/у персонал"], kui: ["куи", "уборочн"], elec: ["электрощит"], server: ["сервер", "архив"],
  };
  KB.programFact = function (S) {
    const prog = S.program || []; const rooms = (S.items || []).filter(i => i.t === "room");
    return prog.map(pr => {
      const keys = MATCH[pr.key] || [norm(pr.name).slice(0, 8)];
      const hit = rooms.filter(r => keys.some(k => norm(r.name).includes(k)) && !(pr.key === "meet" && norm(r.name).includes("vip")));
      const area = hit.reduce((s, r) => s + r.w * r.h, 0), target = pr.n * pr.area;
      return { ...pr, placed: hit.length, factArea: +area.toFixed(1), targetArea: +target.toFixed(1),
        state: hit.length < pr.n ? (hit.length === 0 ? "red" : "yellow") : (area < target * 0.9 ? "yellow" : "ok") };
    });
  };

  /* ------------------------------------------------------------ проверки норм (мягкие) */
  KB.checks = function (S) {
    const out = [], b = S.b || {}, items = S.items || [];
    const rooms = items.filter(i => i.t === "room"), R = (lv) => rooms.filter(r => (r.lv || 0) === lv);
    const add = (level, text, ref, id) => out.push({ level, text, ref, id });
    const area = r => r.w * r.h, has = (r, s) => norm(r.name).includes(s);
    const inner = Math.max(0, (b.w - 0.6) * (b.d - 0.6));
    // МГН санузел
    const wcv = rooms.filter(r => has(r, "с/у посетит") || has(r, "мгн"));
    if (!wcv.length && rooms.length) add("red", "Нет санузла для посетителей с универсальной кабиной МГН.", "СП 59.13330.2020 п. 6.3.2");
    for (const r of wcv) if (Math.min(r.w, r.h) < 2.2 || Math.max(r.w, r.h) < 2.25) add("red", `«${r.name}»: меньше 2,20×2,25 м — универсальная кабина МГН не помещается.`, "СП 59.13330.2020 табл. 6.1", r.id);
    // Тамбур
    for (const r of rooms.filter(r => has(r, "тамбур"))) if (r.h < 2.45) add("yellow", `Тамбур: глубина по ходу движения ${r.h.toFixed(2)} м < 2,45 м.`, "СП 59.13330.2020 п. 6.1.8 (сверить редакцию)", r.id);
    // Антресоль
    const m = R(1).filter(r => !r.sub), mA = m.reduce((s, r) => s + area(r), 0);
    if (m.length) {
      if (b.h < 4.7) add("red", `Высота зала ${b.h} м < 4,7 м — антресоль невозможна.`, "СП 118.13330.2022 п. 4.26");
      if (b.h - b.mz < 2.2) add("red", `Над антресолью ${(b.h - b.mz).toFixed(2)} м < 2,2 м.`, "СП 118.13330.2022 п. 4.26");
      if (b.mz - 0.3 < 2.2) add("red", `Под антресолью ${(b.mz - 0.3).toFixed(2)} м < 2,2 м.`, "СП 118.13330.2022 п. 4.26");
      const share = inner ? mA / inner : 0;
      if (share >= 0.4) add("red", `Антресоль ${Math.round(share * 100)}% площади помещения — может считаться этажом.`, "СП 118.13330.2022 п. 3.1.2");
      else if (share >= 0.35) add("yellow", `Антресоль ${Math.round(share * 100)}% — близко к пределу 40%.`, "СП 118.13330.2022 п. 3.1.2");
      if (mA > 300) add("red", "Антресоль больше 300 м² — нужна вторая лестница.", "СП 1.13130.2020 п. 4.2.7");
      if (!items.some(i => i.t === "item" && /^stair/.test(i.k))) add("red", "На антресоль нет лестницы.", "СП 1.13130.2020 п. 4.4");
      for (const r of m) if (["client", "meet", "office"].includes(r.cat)) add("yellow", `«${r.name}» — клиентское помещение на антресоли: нужен подъёмник для МГН или перенос вниз.`, "СП 59.13330.2020", r.id);
      if (!items.some(i => i.t === "wall" && i.lv === 1 && i.kind === "rail")) add("yellow", "На краю антресоли нет ограждения (h ≥ 1,2 м).", "СП 118.13330.2022 п. 6.12");
    }
    // Бэк-офис: площадь на рабочее место
    const seatsOf = it => ({ os1: 1, os4: 4, work3: 1 }[it.k] || 0);
    for (const r of rooms.filter(r => has(r, "бэк-офис"))) {
      const n = items.filter(i => i.t === "item" && (i.lv || 0) === (r.lv || 0) && i.x >= r.x - .01 && i.y >= r.y - .01 && i.x <= r.x + r.w && i.y <= r.y + r.h).reduce((s, i) => s + seatsOf(i), 0);
      if (n && area(r) / n < 4.5) add("yellow", `«${r.name}»: ${(area(r) / n).toFixed(1)} м² на рабочее место < 4,5 м².`, "МР 2.2.0244-21 (рекомендация)", r.id);
    }
    // Кухня
    const par = (S.meta && S.meta.params) || null;
    if (par) { const staff = par.M + par.B + (par.director ? 1 : 0) + 1, need = staff <= 10 && par.pkg ? 6 : Math.max(12, staff); const k = rooms.filter(r => has(r, "кухн") || has(r, "приём пищи"));
      const kA = k.reduce((s, r) => s + area(r), 0); if (kA + 0.01 < need) add("yellow", `Кухня ${kA.toFixed(1)} м² < ${need} м² (${staff} чел. в смене).`, "СП 44.13330.2011 п. 5.51–5.52 (сверить)"); }
    // Кабинет приёма
    for (const r of rooms.filter(r => has(r, "кабинет менеджер"))) if (area(r) < 9) add("info", `«${r.name}» ${area(r).toFixed(1)} м² — тесно для приёма клиентов (реком. ≥ 9–12 м²).`, "СП 118.13330.2022 п. 5.31 (рекомендация)", r.id);
    // Коридоры
    for (const r of rooms.filter(r => has(r, "коридор") || has(r, "галерея"))) { const w = Math.min(r.w, r.h); if (w < 1.2) add("red", `«${r.name}» шириной ${w.toFixed(2)} м < 1,2 м.`, "СП 1.13130.2020 п. 4.3.4", r.id); else if (w < 1.5) add("yellow", `«${r.name}» ${w.toFixed(2)} м: для разъезда кресел нужно ≥ 1,5–1,8 м.`, "СП 59.13330.2020 п. 6.2.1", r.id); }
    // Геометрия: за контуром здания и пересечения
    for (const r of rooms) if (r.x < -0.01 || r.y < -0.01 || r.x + r.w > b.w + 0.01 || r.y + r.h > b.d + 0.01) add("red", `«${r.name}» выходит за контур здания.`, "геометрия", r.id);
    for (const lv of [0, 1]) { const rs = R(lv).filter(r => !r.sub && !has(r, "зал"));
      for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const a = rs[i], c = rs[j];
        const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
        if (ox > 0.15 && oy > 0.15) add("yellow", `«${a.name}» и «${c.name}» перекрываются.`, "геометрия", a.id); } }
    // Программа
    if (S.program && S.program.length) for (const f of KB.programFact(S)) {
      if (f.placed < f.n) add(f.status === "обязательно" ? "red" : "info", `Программа: «${f.name}» ${f.placed} из ${f.n}.`, "программа помещений");
      else if (f.state === "yellow") add("info", `Программа: «${f.name}» ${f.factArea} м² при цели ${f.targetArea} м².`, "программа помещений");
    }
    const order = { red: 0, yellow: 1, info: 2 };
    return out.sort((a, c) => order[a.level] - order[c.level]);
  };

  /* ------------------------------------------------------------ текстовая сводка (для Claude и CLI) */
  KB.summary = function (S) {
    const rooms = (S.items || []).filter(i => i.t === "room" && !i.sub);
    const a0 = rooms.filter(r => !r.lv).reduce((s, r) => s + r.w * r.h, 0), a1 = rooms.filter(r => r.lv === 1).reduce((s, r) => s + r.w * r.h, 0);
    const lines = [`${S.name}: здание ${S.b.w}×${S.b.d}×${S.b.h} м, 1 этаж ${a0.toFixed(1)} м², антресоль ${a1.toFixed(1)} м²`];
    if (S.program) { lines.push("Программа (цель → факт):"); for (const f of KB.programFact(S)) lines.push(`  ${f.state === "ok" ? "✓" : f.state === "yellow" ? "~" : "✗"} ${f.name}: ${f.placed}/${f.n} шт, ${f.factArea}/${f.targetArea} м²`); }
    const ch = KB.checks(S); lines.push(`Проверки: ${ch.filter(c => c.level === "red").length} красных, ${ch.filter(c => c.level === "yellow").length} жёлтых`);
    for (const c of ch) lines.push(`  [${c.level}] ${c.text} (${c.ref})`);
    return lines.join("\n");
  };

  /* ------------------------------------------------------------ описание для ИИ-помощника */
  KB.PARAM_SCHEMA_TEXT = `{"name":string,"w":число м (длина вдоль дороги),"d":число м (глубина),"h":число м (высота),"M":менеджеров на смене,"B":сотрудников бэк-офиса,"maket":"3x2"|"5x3"|"6x4","kids":bool,"cafe":bool,"wardrobe":bool,"bank":bool,"cashier":bool,"media":bool,"showroom":bool,"director":bool,"mezz":"auto"|"yes"|"no"}`;

  if (typeof module !== "undefined" && module.exports) module.exports = KB; else root.OfficeKB = KB;
})(typeof window !== "undefined" ? window : globalThis);
