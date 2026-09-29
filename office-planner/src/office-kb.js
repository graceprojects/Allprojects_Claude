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
  KB.MAKET = { "3x2": [3, 2], "5x3": [5, 3], "6x4": [6, 4] };

  /* ------------------------------------------------------------ программа помещений */
  KB.program = function (p0) {
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
    const need = pr.rows.reduce((s, r) => s + r.n * r.area, 0), k = 1.35;
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
    const shallow = D < 11, rowD = shallow ? 3.0 : 3.2, aisle = shallow ? 1.5 : 1.8, yA = y0 + rowD + aisle, df = y1 - yA;
    const deep = df >= 8.6; // глубокий зал: второй ряд кабинетов и две полосы у витража
    const dfS = df > 7.4 ? 6.2 : df; // глубина сервисного блока; при глубоком здании зал продолжается вдоль витража
    if (df < 4.5) warn.push(`Глубина здания мала для схемы с проходом: у витража остаётся ${df.toFixed(1)} м.`);
    const mk0 = (k, w, extra = {}) => { const pr = get(k); return Object.assign({ key: k, name: pr.name, cat: pr.cat, border: pr.border, color: pr.color, w, w0: w }, extra); };
    // задний ряд: клиентская часть
    let hallRow = [];
    if (get("cafe")) hallRow.push(mk0("cafe", 4));
    if (get("wardrobe")) hallRow.push(mk0("wardrobe", 2));
    for (let i = 0; i < get("cabinet").n; i++) hallRow.push(mk0("cabinet", 3));
    for (let i = 0; i < get("meet").n; i++) hallRow.push(mk0("meet", 4.5));
    if (get("bank")) for (let i = 0; i < get("bank").n; i++) hallRow.push(mk0("bank", 3));
    if (get("showroom")) hallRow.push(mk0("showroom", 5));
    // задний ряд: служебная часть в правом торце; лестница — у торца, чтобы антресоль была компактной
    const wcv = get("wcv"), wcs = get("wcs");
    const svcRow = [];
    svcRow.push({ key: "wcv", name: wcv.name, cat: "wc", border: "wall", w: p.M >= 6 ? 3.9 : 2.4, color: wcv.color });
    for (let i = 0; i < wcs.n; i++) svcRow.push({ key: "wcs", name: wcs.name, cat: "wc", border: "wall", w: 1.8, color: wcs.color });
    svcRow.push({ key: "kui", name: "КУИ", cat: "service", border: "wall", w: 1.8 });
    svcRow.push({ key: "elec", name: "Электрощитовая", cat: "service", border: "wall", w: 2.0 });
    if (!mezz) svcRow.push({ key: "server", name: "Серверная / архив", cat: "service", border: "wall", w: 2.0 });
    if (mezz) svcRow.push({ key: "stair", name: "Лестничная клетка", cat: "circ", border: "none", w: 2.8 });
    // передний ряд у витража в правом торце
    const vip = get("vip"), kit = get("kitchen"), bo = get("backoffice"), dir = get("director"), cash = get("cashier");
    const front = [];
    for (let i = 0; i < vip.n; i++) front.push({ key: "vip", name: vip.name, cat: "meet", border: "glass", w: Math.max(4.2, vip.area / dfS), color: vip.color });
    if (cash) front.push({ key: "cashier", name: "Касса", cat: "service", border: "wall", w: Math.max(2.4, 9 / dfS) });
    front.push({ key: "kitchen", name: kit.name, cat: "staff", border: "wall", w: Math.max(2.6, kit.area / dfS) });
    if (!mezz) {
      if (dir) front.push({ key: "director", name: dir.name, cat: "back", border: "wall", w: Math.max(3.2, 18 / dfS), color: dir.color });
      front.push({ key: "backoffice", name: bo.name, cat: "back", border: "glass", w: Math.max(3, bo.area / dfS) });
    }
    const mkS = KB.MAKET[p.maket] || KB.MAKET["5x3"];
    const needPublic = (get("kids") ? 4.0 : 0) + (get("cafe") ? 4.4 : 0) + mkS[0] + 2.4 + 1.2 + 4.8 + Math.min(Math.ceil(get("lounge").seats / 5), 2) * 2.8;
    const pubMin = Math.max(needPublic, 0.45 * Lin);
    const canRow2 = df >= 7.8;
    // переполнение заднего ряда: кабинеты — во второй ряд (остров), переговорные и ипотека — к VIP или во второй ряд,
    // кофе-поинт — в публичную зону, остальное — «не размещено»
    const row2 = []; let cafePublic = false;
    const over = () => sum(hallRow) + sum(svcRow) - Lin;
    const takeLast = k => { const i = hallRow.map(r => r.key).lastIndexOf(k); return i < 0 ? null : hallRow.splice(i, 1)[0]; };
    for (const k of ["cafe", "bank", "meet", "showroom", "wardrobe", "cabinet"]) {
      while (over() > 1e-6) {
        const it = takeLast(k); if (!it) break;
        if (k === "cafe") { cafePublic = true; continue; }
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
    // вход — по оси пролёта между колоннами (шаг 5 м), ближе к середине публичной зоны
    const xP = dfS < df ? x1 : x1 - sum(front);        // правая граница публичной полосы у витража
    const kidEnd = (get("kids") ? x0 + 4.0 : x0) + (cafePublic ? 4.4 : 0), mwS = mkS[0] + 2.4;
    const cE = (() => { const target = x0 + (xP - x0) * 0.55, cands = [];
      for (let k = 0; k * 5 + 2.5 < W; k++) { const c = k * 5 + 2.5; if (c - 2.4 < kidEnd || c + 2.4 > Math.min(xP, xs) - 0.3) continue; cands.push(c); }
      if (!cands.length) return Math.max(kidEnd + 2.4, x0 + (xP - x0) / 2);
      cands.sort((a, b) => Math.abs(a - target) - Math.abs(b - target));
      return cands.find(c => c - 3.0 - mwS >= kidEnd + 0.3) ?? cands.find(c => xP - 0.3 - (c + 3.0) >= mwS) ?? cands[0]; })();
    // вход — по оси пролёта между колоннами (шаг 5 м), ближе к середине публичной зоны
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
      if (k === "cabinet" || k === "bank") { I.push(furn("work3", x + w / 2 - 0.8, y0 + 0.4)); I.push(furn("slide", x + 0.3, y0 + rowD - 0.15)); }
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

    // публичная полоса у витража: детская | ожидание | макет | вход + ресепшен | ожидание | (сервисный блок)
    I.push(room("Тамбур", cE - 1.3, y1 - 2.5, 2.6, 2.5, "circ", "glass", { sub: true }));
    I.push(door({ x: cE - 0.9, y: y1, w: 1.8, h: 0.001 }, "n", 0, 1.8, true));
    I.push(door({ x: cE - 0.9, y: y1 - 2.5, w: 1.8, h: 0.001 }, "n", 0, 1.8, true));
    const recY = Math.max(yA + 0.2, y1 - 2.5 - 1.5 - 2.4);
    if (y1 - 2.5 - (recY + 2.4) < 1.2) warn.push("Мало места между тамбуром и ресепшен (зона «декомпрессии» < 1,2 м).");
    I.push(room("Ресепшен", cE - 2.2, recY, 4.4, 2.4, "client", "none", { sub: true }));
    I.push(furn("recep", cE - 1.5, recY + 1.3, 180)); I.push(furn("chairO", cE - 0.8, recY + 0.5)); I.push(furn("chairO", cE + 0.2, recY + 0.5));
    const blocked = [[cE - 2.4, cE + 2.4]];
    if (cafePublic) { const cx0 = get("kids") ? x0 + 4.0 : x0; I.push(room("Кофе-поинт", cx0, y1 - 3.5, 4, 3.5, "client", "none", { sub: true, color: "#D9B98E" })); I.push(furn("bar", cx0 + 0.3, y1 - 3.2, 0, { w: 3.4 })); I.push(furn("cafe4", cx0 + 1.0, y1 - 2.3)); blocked.push([cx0, cx0 + 4.4]); }
    if (get("kids")) { I.push(room("Детская зона", x0, y1 - 3.5, 3.5, 3.5, "client", "none", { sub: true, color: "#F4D36B" })); I.push(furn("kidmat", x0 + 0.3, y1 - 2.4, 0, { w: 1.8, h: 1.6 })); I.push(furn("kidtab", x0 + 1.6, y1 - 3.3)); blocked.push([x0, kidEnd]); }
    let mk = mkS, mw = mk[0] + 2.4, mh = mk[1] + 2.4;
    const twoBands = y1 - yP >= 3.5 + 1.0 + mh + 0.3;   // макет помещается в глубине, у витража остаётся полоса ожидания
    let mzy = twoBands ? y1 - 3.5 - 1.0 - mh : y1 - 0.6 - mh;
    if (!twoBands && mzy < yP - 1e-6) { mk = KB.MAKET["3x2"]; mw = 5.4; mh = 4.4; mzy = y1 - 0.6 - mh; warn.push("Стол макета уменьшен до 3×2: не хватает глубины зала."); }
    const solid = () => I.filter(i => i.t === "room" && !(i.lv) && (!i.sub || /Ресепшен|Тамбур/.test(i.name)) && !/Зал продаж|Проход/.test(i.name));
    const clash = (x, y, w, h) => solid().some(r => x < r.x + r.w - 0.05 && x + w > r.x + 0.05 && y < r.y + r.h - 0.05 && y + h > r.y + 0.05);
    const fits = x => x >= kidEnd + 0.3 - 1e-6 && x + mw <= xP - 0.3 + 1e-6 && !clash(x - 0.3, mzy, mw + 0.6, mh);
    let mx = [cE - 3.0 - mw, cE + 3.0, cE - mw / 2, kidEnd + 0.3, xP - 0.3 - mw].find(fits);
    if (mx === undefined) { for (let x = kidEnd + 0.3; x + mw <= xP - 0.3; x += 0.5) if (fits(x)) { mx = x; break; } }
    if (mx === undefined && mk !== KB.MAKET["3x2"]) { mk = KB.MAKET["3x2"]; mw = 5.4; mh = 4.4; mzy = twoBands ? y1 - 3.5 - 1.0 - mh : y1 - 0.6 - mh; mx = [cE - 3.0 - mw, cE + 3.0, cE - mw / 2].find(fits); if (mx !== undefined) warn.push("Стол макета уменьшен до 3×2, чтобы не мешать входу."); }
    if (mx === undefined) { mx = Math.max(kidEnd + 0.3, cE - 3.0 - mw); warn.push("Зоне макета тесно рядом со входом — проверьте проходы."); }
    const mzr = room("Зона макета", mx, mzy, mw, mh, "client", "none", { sub: true, color: "#F2F0EA" }); I.push(mzr);
    I.push(furn("model", mx + 1.2, mzr.y + 1.2, 0, { w: mk[0], h: mk[1] }));
    if (!twoBands) blocked.push([mx - 0.4, mx + mw + 0.4]);
    const lounge = get("lounge"), groups = Math.ceil(lounge.seats / 5), step = 2.8;
    const free = []; let cur = x0 + 0.3;
    blocked.sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { if (a > cur) free.push([cur, a]); cur = Math.max(cur, b); });
    if (xP - 0.4 > cur) free.push([cur, xP - 0.4]);
    let placedG = 0;
    for (const [a, b] of free) { let gx = a + 0.2, first = null, last = null;
      while (gx + 2.2 <= b - 0.2 && placedG < groups) { I.push(furn("lounge", gx, y1 - 3.3)); if (first === null) first = gx; last = gx + 2.2; gx += step; placedG++; }
      if (first !== null) I.push(room("Зона ожидания", first - 0.2, y1 - 3.5, last - first + 0.4, 3.5, "client", "none", { sub: true, color: "#F3E6CF" })); }
    if (placedG < groups) { // дополнительные мягкие зоны — в свободных местах зала
      const occ = I.filter(i => (i.lv || 0) === 0 && (i.t === "item" || (i.t === "room" && i.name !== "Зал продаж"))).map(i => { const q = (i.rot || 0) % 180 ? [i.h, i.w] : [i.w, i.h]; return [i.x, i.y, q[0], q[1]]; });
      const hit = (x, y, w, h, m) => occ.some(([a, b, c, d]) => x < a + c + m && x + w + m > a && y < b + d + m && y + h + m > b);
      for (let y = y1 - 3.3; y >= yP + 0.4 && placedG < groups; y -= 0.5)
        for (let x = x0 + 0.4; x + 2.2 <= xP - 0.4 && placedG < groups; x += 0.5) {
          if (x + 2.2 > cE - 1.6 && x < cE + 1.6) continue;           // ось входа свободна
          if (hit(x, y, 2.2, 2.9, 0.8)) continue;
          I.push(furn("lounge", x, y)); I.push(room("Зона ожидания", x - 0.2, y - 0.2, 2.6, 3.3, "client", "none", { sub: true, color: "#F3E6CF" }));
          occ.push([x, y, 2.2, 2.9]); placedG++; }
    }
    if (placedG < groups) warn.push(`Мягких зон в зале: ${placedG} из ${groups} (мест ${placedG * 5} из ${lounge.seats}).`);
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
    cafe: ["кофе", "бар", "кафе"], wardrobe: ["гардероб"], media: ["медиа", "vr"], cabinet: ["кабинет менеджер"], meet: ["переговорн"],
    bank: ["ипотек", "банк"], showroom: ["шоурум"], vip: ["сделочн", "vip"], cashier: ["касса"], wcv: ["с/у посетит", "с/у мгн", "санузел посетит"], stair: ["лестнич"],
    backoffice: ["бэк-офис", "бэк офис", "back"], director: ["руководител"], kitchen: ["кухн", "приём пищи", "прием пищи", "отдыха"],
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
    if (par) { const staff = par.M + par.B + (par.director ? 1 : 0) + 1, need = Math.max(12, staff); const k = rooms.filter(r => has(r, "кухн") || has(r, "приём пищи"));
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
