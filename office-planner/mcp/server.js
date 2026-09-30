#!/usr/bin/env node
/* MCP-сервер «Планировщик офиса продаж».
 * Claude (Desktop / Code) управляет планировщиком как Blender через MCP: ставит помещения, мебель, двери,
 * проверяет нормы и смотрит на картинку плана. Изменения сразу видны в открытом браузере.
 *
 *   stdio  — протокол MCP (JSON-RPC 2.0, по строке на сообщение);
 *   http://127.0.0.1:8765 — сам планировщик + живая синхронизация (Server-Sent Events).
 * Без зависимостей: нужен только Node 18+.  Данные: ~/OfficePlanner (или OFFICE_PLANNER_DIR).
 */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), os = require("os"), cp = require("child_process");
const HERE = __dirname;
const KB = require(fs.existsSync(path.join(HERE, "office-kb.js")) ? path.join(HERE, "office-kb.js") : path.join(HERE, "..", "src", "office-kb.js"));
const VERSION = "1.0.0";
const DATA = process.env.OFFICE_PLANNER_DIR || path.join(os.homedir(), "OfficePlanner");
const CUR = path.join(DATA, "current.json");
const PORT0 = +process.env.OFFICE_PLANNER_PORT || 8765;
const log = (...a) => process.stderr.write("[office-planner] " + a.join(" ") + "\n");
try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}

/* ------------------------------------------------------------ состояние */
let S = null, rev = 1, lastSource = "server";
const hist = [], fut = [];
function load() {
  try { S = JSON.parse(fs.readFileSync(CUR, "utf8")); if (!S.b || !S.items) throw 0; }
  catch (e) { S = KB.generate({ name: "Офис продаж 40×12 (пример)" }).project; }
}
function save() { try { fs.writeFileSync(CUR, JSON.stringify(S, null, 1)); } catch (e) { log("не сохранено:", e.message); } }
function snapshot() { hist.push(JSON.stringify(S)); if (hist.length > 80) hist.shift(); fut.length = 0; }
function changed(src) { rev++; lastSource = src || "claude"; save(); broadcast("state", { rev, src: lastSource, project: S }); }
load();

/* ------------------------------------------------------------ HTTP: планировщик + синхронизация */
const clients = new Set(); const pending = new Map(); let port = 0;
const APP = [path.join(HERE, "app"), path.join(HERE, "..", "local")].find(d => fs.existsSync(path.join(d, "index.html")));
// кому можно читать и менять план: localhost, сайт планировщика и claude.ai. Чужие *.github.io и «null» (песочницы) — нет.
// Офлайн-файл (file://) шлёт Origin: null — разрешите его явно: OFFICE_PLANNER_ALLOW_FILE=1.
const ALLOWED = new RegExp("^(https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?|https://graceprojects\\.github\\.io|https://([a-z0-9-]+\\.)*claude(usercontent)?\\.(ai|com)" + (process.env.OFFICE_PLANNER_ALLOW_FILE === "1" ? "|null" : "") + ")$", "i");
function cors(req, res) {
  const o = req.headers.origin; if (o && ALLOWED.test(o)) { res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary", "Origin"); }
  res.setHeader("Access-Control-Allow-Private-Network", "true"); res.setHeader("Access-Control-Allow-Headers", "content-type"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return !o || ALLOWED.test(o);
}
function broadcast(ev, data) { const s = `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`; for (const c of clients) try { c.res.write(s); } catch (e) {} }
function body(req) { return new Promise((ok, no) => { let b = ""; req.on("data", d => { b += d; if (b.length > 3e7) req.destroy(); }); req.on("end", () => ok(b)); req.on("error", no); }); }
const server = http.createServer(async (req, res) => {
  const okOrigin = cors(req, res); const u = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (!okOrigin) { res.writeHead(403); return res.end("origin"); }
  if (req.method === "POST" && !/^application\/json/i.test(req.headers["content-type"] || "")) { res.writeHead(415); return res.end("json only"); }   // простой form-POST с чужой страницы не пройдёт
  try {
    if (u.pathname === "/api/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      const c = { res, id: u.searchParams.get("client") || "?" }; clients.add(c);
      res.write(`event: state\ndata: ${JSON.stringify({ rev, src: "server", project: S })}\n\n`);
      const t = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 20000);
      req.on("close", () => { clearInterval(t); clients.delete(c); }); return;
    }
    if (u.pathname === "/api/state" && req.method === "GET") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ rev, project: S })); }
    if (u.pathname === "/api/state" && req.method === "POST") { // правка из браузера (пользователь двигает мышкой)
      const m = JSON.parse(await body(req)); if (!m.project || !m.project.b || !Array.isArray(m.project.items)) throw new Error("bad project");
      snapshot(); S = m.project; rev++; lastSource = "user"; save(); broadcast("state", { rev, src: m.client || "user", project: S });
      res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ rev }));
    }
    if (u.pathname === "/api/render" && req.method === "POST") { // картинка плана от браузера
      const m = JSON.parse(await body(req)); const p = pending.get(m.req); if (p) { pending.delete(m.req); p(m); }
      res.writeHead(200); return res.end("ok");
    }
    if (u.pathname === "/api/ping") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ ok: true, name: "office-planner", version: VERSION, rev })); }
    // статика планировщика
    if (!APP) { res.writeHead(404); return res.end("planner files not found"); }
    let f = decodeURIComponent(u.pathname); if (f === "/") f = "/index.html";
    const fp = path.normalize(path.join(APP, f)); if (!fp.startsWith(APP) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("not found"); }
    const ext = path.extname(fp), type = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png" }[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" }); fs.createReadStream(fp).pipe(res);
  } catch (e) { res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }); res.end(String(e.message || e)); }
});
(function listen(p, tries) {
  server.once("error", e => { if (e.code === "EADDRINUSE" && tries > 0) return listen(p + 1, tries - 1); log("HTTP не запущен:", e.message); });
  server.listen(p, "127.0.0.1", () => { port = p; log(`планировщик: http://localhost:${p}  данные: ${DATA}`); });
})(PORT0, 10);
const url = () => port ? `http://localhost:${port}/` : "(HTTP-сервер не запущен)";
function openBrowser() {
  const u = url(); if (!port) return false;
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", u]] : process.platform === "darwin" ? ["open", [u]] : ["xdg-open", [u]];
  try { cp.spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" }).unref(); return true; } catch (e) { return false; }
}
function requestRender(o) {
  if (!clients.size) return Promise.resolve(null);
  const id = Math.random().toString(36).slice(2);
  return new Promise(ok => { const t = setTimeout(() => { pending.delete(id); ok(null); }, 15000); pending.set(id, m => { clearTimeout(t); ok(m); }); broadcast("render", Object.assign({ req: id }, o)); });
}

/* ------------------------------------------------------------ инструменты MCP */
const refs = (() => { const out = {}; for (const d of [path.join(HERE, "guide"), path.join(HERE, "..", "..", ".claude", "skills", "sales-office-planning", "references")]) {
  try { for (const f of fs.readdirSync(d)) if (f.endsWith(".md") && !out[f.replace(".md", "")]) out[f.replace(".md", "")] = fs.readFileSync(path.join(d, f), "utf8"); } catch (e) {} } return out; })();

const P = (props, req = []) => ({ type: "object", properties: props, required: req });
const n = d => ({ type: "number", description: d }), s = d => ({ type: "string", description: d }), bo = d => ({ type: "boolean", description: d });
const REF = s("id элемента (из describe_plan) или его название, например «Кабинет менеджера» или «кухня»");
const OP_PROPS = {
  add_room: { name: s("Название (по нему определяется тип и мебель): «Кабинет менеджера», «Переговорная на 6», «Сделочная / VIP», «Кухня персонала», «С/у МГН», «Бэк-офис», «Кабинет РОП», «Зона ожидания», «Зона макета», «Детская зона», «Кофе-поинт» …"),
    x: n("левый край, м (не задан — найдётся свободное место)"), y: n("верхний край, м (Y растёт к витражу)"), w: n("ширина по X, м"), h: n("глубина по Y, м"),
    lv: n("0 — 1 этаж, 1 — антресоль"), cat: s("client|office|meet|back|staff|service|wc|circ (обычно не нужно — берётся из названия)"),
    border: s("none — зона без стен | wall — стены | glass — стеклянные перегородки"), color: s("цвет пола #RRGGBB"), sub: bo("зона внутри другого помещения (не считается в сумму площадей)"),
    near: s("где искать место, если x/y не заданы: facade|back|left|right|center"), furnish: bo("расставить мебель автоматически (по умолчанию да)") },
  update: { id: REF, x: n("новый X"), y: n("новый Y"), w: n("новая ширина"), h: n("новая глубина"), dx: n("сдвиг по X"), dy: n("сдвиг по Y"), new_name: s("новое название"),
    label: s("подпись предмета"), rot: n("поворот предмета 0|90|180|270"), cat: s("категория"), border: s("none|wall|glass"), color: s("цвет пола"), lv: n("уровень"),
    move_contents: bo("двигать мебель вместе с помещением (да)"), refurnish: bo("при изменении размера переставить мебель (да)"),
    x1: n("стена: x1"), y1: n("стена: y1"), x2: n("стена: x2"), y2: n("стена: y2") },
  delete: { id: REF, with_contents: bo("удалить и мебель внутри (да)") },
  add_item: { k: s("ключ предмета из list_catalog, например work3, meet6, sofa3, lounge, model, recep, kitch, wc, plant"), x: n("X левого-верхнего угла"), y: n("Y"),
    room: s("поставить внутрь помещения (id/название) — место найдётся само"), rot: n("0|90|180|270"), w: n("ширина (растянуть)"), h: n("глубина"),
    size: s("типоразмер: номер или название из list_catalog, например «на 8» или «3-местный 2200»"), count: n("сколько штук в ряд"), dir: s("x|y — направление ряда"), gap: n("зазор в ряду, м"), label: s("подпись"), lv: n("уровень"), near: s("facade|back|left|right|center") },
  furnish: { room: REF, replace: bo("убрать старую мебель (да)"), face: s("n|s|e|w — лицевая сторона (дверь/обзор); по умолчанию определяется сама"), seats: n("бэк-офис: сколько рабочих мест") },
  clear: { room: REF, doors: bo("убрать и двери") },
  add_door: { room: REF, side: s("n|s|e|w (по умолчанию — к проходу)"), offset: n("от угла, м"), width: n("ширина, м (0.9, 1.0, 1.8)"), type: s("swing|slide"), inward: bo("внутрь"), label: s("подпись, напр. «Вход»") },
  add_wall: { kind: s("ext|block|part|glass|vitrage|rail"), x1: n(""), y1: n(""), x2: n(""), y2: n(""), lv: n("уровень") },
  building: { w: n("длина вдоль дороги"), d: n("глубина"), h: n("высота"), mz: n("отметка антресоли"), name: s("название проекта"), notes: s("примечания для проектировщика") },
  floor: { room: REF, color: s("#RRGGBB, см. list_catalog") },
};
const TOOLS = [
  { name: "open_planner", description: "Открыть планировщик в браузере пользователя (живой вид: всё, что вы меняете, сразу видно). Вызывайте в начале работы.", inputSchema: P({}) },
  { name: "describe_plan", description: "Текущий план текстом: здание, все помещения с id, координатами, размерами, площадью и мебелью внутри, ASCII-схема 1 этажа, программа цель/факт и проверки норм. Вызывайте перед любыми правками.", inputSchema: P({ ascii: bo("добавить ASCII-схему (да)"), items: bo("перечислять мебель (да)") }) },
  { name: "view_plan", description: "Картинка плана (PNG) из открытого браузера — посмотреть, как всё легло. Нужно, чтобы планировщик был открыт (open_planner). Без браузера вернёт ASCII-схему.", inputSchema: P({ view: s("2d (по умолчанию) | 3d"), lv: n("для 3d не нужен") }) },
  { name: "package_program", description: "Программа помещений варианта наполнения S «Базовый», M «Стандарт», L «Премиум» для площади: помещения, количество, м², почему. План не меняет.", inputSchema: P({ pkg: s("S|M|L"), area: n("площадь офиса, м²"), opts: { type: "object", description: "включить/выключить опции: {kids:false, cashier:true …}" }, counts: { type: "object", description: "ручные количества: {cabinet:5}" } }, ["pkg", "area"]) },
  { name: "new_office", description: "Собрать новый офис продаж с нуля по пакету и площади (или по размерам здания) — черновая раскладка генератором. Заменяет текущий план (можно отменить undo).", inputSchema: P({ pkg: s("S|M|L"), area: n("м²"), name: s("название"), w: n("длина здания вдоль дороги, м (иначе подбирается)"), d: n("глубина, м"), h: n("высота, м"), mezz: s("auto|yes|no — антресоль"), opts: { type: "object" }, counts: { type: "object" }, M: n("менеджеров (без пакета)"), B: n("бэк-офис (без пакета)"), maket: s("2x1.5|3x2|5x3|6x4") }) },
  { name: "auto_plan", description: "ГЛАВНЫЙ способ собрать офис: размеры здания + вариант наполнения → движок сам строит зонирование (служебное ядро, кабинеты вдоль глухой стены, публичная зона у витража, антресоль при высоте ≥ 6,2 м) и подгоняет программу под размеры. Возвращает журнал решений. Заменяет текущий план (undo вернёт).", inputSchema: P({ w: n("длина вдоль улицы, м"), d: n("глубина, м"), h: n("высота потолка, м"), level: s("S — Базовый (максимум мест продаж) | M — Стандарт | L — Премиум (бар, детская, шоурум, медиа)"), mezz: s("auto|yes|no — антресоль"), name: s("название") }, ["w", "d", "level"]) },
  { name: "compare_variants", description: "Сравнить три варианта наполнения (Базовый / Стандарт / Премиум) для размеров здания: сколько мест продаж, ожидания, переговорных, что убрано и почему. План не меняет.", inputSchema: P({ w: n("длина, м"), d: n("глубина, м"), h: n("высота, м"), mezz: s("auto|yes|no") }, ["w", "d"]) },
  { name: "blank_building", description: "Пустое здание заданных размеров (без помещений) — чтобы расставлять всё самому.", inputSchema: P({ w: n("длина"), d: n("глубина"), h: n("высота"), name: s("название") }, ["w", "d"]) },
  { name: "add_room", description: "Добавить помещение или зону. Тип (кабинет, переговорная, с/у, кухня, бэк-офис, макет, ожидание…) распознаётся по названию: подставляются категория, стены, типовой размер и мебель с дверью к проходу.", inputSchema: P(OP_PROPS.add_room, ["name"]) },
  { name: "update_element", description: "Передвинуть / изменить размер / переименовать помещение, предмет или стену. Помещение двигается вместе с мебелью; при изменении размера мебель переставляется.", inputSchema: P(OP_PROPS.update, ["id"]) },
  { name: "delete_element", description: "Удалить помещение (с мебелью внутри), предмет или стену.", inputSchema: P(OP_PROPS.delete, ["id"]) },
  { name: "add_furniture", description: "Поставить предмет из каталога (list_catalog) по координатам или внутрь помещения; count — ряд одинаковых.", inputSchema: P(OP_PROPS.add_item, ["k"]) },
  { name: "furnish_room", description: "Автоматически расставить мебель в помещении по его типу (по стандартам: рабочее место с гостями, стол переговоров по размеру, сантехника МГН, open-space бэк-офиса и т.д.).", inputSchema: P(OP_PROPS.furnish, ["room"]) },
  { name: "add_furniture_set", description: "Поставить готовый набор мебели стандартных размеров (рабочее место менеджера, переговорная на 4–12, лаунж на 2–8, ресепшен, кухня, бэк-офис, детская, бар, гардероб, шоурум, макет, архив, санузел, фон-боксы). Список наборов и вариантов — list_catalog. В помещение: {set, room, variant:\"auto\"} — самый крупный вариант, что помещается (учитывает «на 6» в названии); в точку: {set, variant, x, y, lv}.", inputSchema: { type: "object", properties: { set: { type: "string", description: "ключ набора: mgr, cons, rop, meet, vip, lounge, recep, kitchen, back, kids, cafe, ward, show, maket, arch, wc, focus" }, variant: { description: "номер варианта, часть названия или \"auto\"" }, room: { type: "string", description: "помещение (id или название); старая мебель в нём заменяется" }, x: { type: "number" }, y: { type: "number" }, lv: { type: "number" }, face: { type: "string", enum: ["s", "n", "e", "w"], description: "куда смотрит перед набора (по умолчанию — к двери)" }, replace: { type: "boolean" } }, required: ["set"] } },
  { name: "clear_room", description: "Убрать мебель из помещения.", inputSchema: P(OP_PROPS.clear, ["room"]) },
  { name: "add_door", description: "Добавить дверь в помещение на нужной стороне.", inputSchema: P(OP_PROPS.add_door, ["room"]) },
  { name: "add_wall", description: "Стена / перегородка / витраж / ограждение по двум точкам.", inputSchema: P(OP_PROPS.add_wall, ["x1", "y1", "x2", "y2"]) },
  { name: "set_building", description: "Размеры здания, название, примечания.", inputSchema: P(OP_PROPS.building) },
  { name: "set_floor", description: "Цвет пола помещения.", inputSchema: P(OP_PROPS.floor, ["room", "color"]) },
  { name: "batch", description: "Выполнить много команд за один раз (быстрее). ops — массив объектов {op, ...параметры}; op: add_room | update | delete | add_item | furnish | clear | add_door | add_wall | building | floor | generate. Параметры — как у одноимённых инструментов (у update/delete — id).", inputSchema: P({ ops: { type: "array", items: { type: "object" } }, atomic: bo("при ошибке откатить весь пакет") }, ["ops"]) },
  { name: "find_free_space", description: "Найти свободное место w×h (не занятое помещениями и мебелью) — куда поставить новое помещение или предмет.", inputSchema: P({ w: n("м"), h: n("м"), lv: n("уровень"), near: s("facade|back|left|right|center"), within: s("внутри помещения"), margin: n("отступ от соседей, м (0.3)") }, ["w", "h"]) },
  { name: "check_plan", description: "Проверка: программа цель/факт и мягкие нормы (СП 59, 118, 1.13130, 44) со ссылками.", inputSchema: P({}) },
  { name: "list_catalog", description: "Каталог мебели (ключи и размеры), типы помещений и цвета пола.", inputSchema: P({ group: s("фильтр группы: «кухня», «переговорные» …") }) },
  { name: "planning_guide", description: "Методика планировки офиса продаж: method (принципы и зонирование), program (состав и площади), packages (пакеты S/M/L), norms (нормы СП), planner-format (формат файла).", inputSchema: P({ topic: s("method|program|packages|norms|planner-format") }, ["topic"]) },
  { name: "undo", description: "Отменить последнее изменение (своё или пользователя).", inputSchema: P({}) },
  { name: "redo", description: "Вернуть отменённое.", inputSchema: P({}) },
  { name: "save_project", description: "Сохранить проект в файл .json (по умолчанию в ~/OfficePlanner).", inputSchema: P({ file: s("имя файла или полный путь") }) },
  { name: "open_project", description: "Открыть проект из файла .json или показать список сохранённых.", inputSchema: P({ file: s("имя файла или путь; пусто — список") }) },
];
const text = t => ({ content: [{ type: "text", text: t }] });
const err = t => ({ content: [{ type: "text", text: t }], isError: true });
function mutate(fn) { snapshot(); const before = JSON.stringify(S); try { const r = fn(); if (JSON.stringify(S) !== before) changed("claude"); else hist.pop(); return r; } catch (e) { S = JSON.parse(before); hist.pop(); throw e; } }
function brief() { const ch = KB.checks(S); const r = ch.filter(c => c.level === "red").length, y = ch.filter(c => c.level === "yellow").length; return `\nПроверки: ${r} важных, ${y} внимание.${clients.size ? "" : " (Браузер не открыт — open_planner, чтобы пользователь видел план.)"}`; }
const opRun = (op, a) => mutate(() => { const r = KB.apply(S, Object.assign({ op }, a)); return text(r.msg + brief()); });
function fileOf(f) { f = String(f || "").trim(); if (!f) f = (S.name || "office").replace(/[\\/:*?"<>|]+/g, "_") + ".json"; if (!/\.json$/i.test(f)) f += ".json"; return path.isAbsolute(f) ? f : path.join(DATA, f); }

async function callTool(name, a = {}) {
  switch (name) {
    case "open_planner": { const ok = openBrowser(); return text(port ? `${ok ? "Открываю" : "Откройте"} ${url()} — планировщик подключится к Claude автоматически (в шапке «● Claude»). Можно подключить и сайт: кнопка «Claude» → «Подключить».` : "HTTP-сервер не запустился (порт занят?)."); }
    case "describe_plan": return text(KB.describe(S, a));
    case "view_plan": {
      const m = await requestRender({ view: a.view || "2d", lv: a.lv });
      if (!m || !m.png) return text((clients.size ? "Браузер не прислал картинку за 15 с. " : "Планировщик не открыт в браузере (open_planner). ") + "Схема:\n" + KB.ascii(S, 0));
      return { content: [{ type: "image", data: m.png.replace(/^data:image\/\w+;base64,/, ""), mimeType: "image/png" }, { type: "text", text: `План «${S.name}», ${S.b.w}×${S.b.d} м. Номера на плане — порядок сверху вниз, слева направо; id и координаты — в describe_plan.` }] };
    }
    case "package_program": {
      const pp = KB.packageProgram(a.pkg, +a.area, a.opts || {}, a.counts || {}), pk = KB.PACKAGES[a.pkg];
      const L = [`Пакет ${a.pkg} «${pk.name}» на ${a.area} м²: менеджеров M=${pp.vars.M}, бэк-офис B=${pp.vars.B}, мест ожидания ${pp.vars.seats}, макет ${pp.maket}.`,
        `Помещения ${pp.net} м² × ${pp.k} (проходы, стены) = ${pp.need} м²${pp.need > a.area ? ` — НЕ хватает ${Math.round(pp.need - a.area)} м²` : " — помещается"}.`, ""];
      for (const r of pp.rows) L.push(`${r.name}: ${r.n > 1 ? r.n + " × " : ""}${r.area} м² = ${(r.n * r.area).toFixed(1)} м² · ${r.status}${r.rule ? " · " + r.rule : ""}`);
      const b = KB.suggestBuilding(a.pkg, +a.area); L.push("", `Здание по умолчанию: ${b.w}×${b.d}×${b.h} м.`); return text(L.join("\n"));
    }
    case "new_office": return mutate(() => { const g = KB.generateFor(a); S = g.project;
      return text(`Собран «${S.name}»: здание ${S.b.w}×${S.b.d}×${S.b.h} м${g.mezz ? ", с антресолью" : ""}.\n${g.warnings.length ? "Предупреждения генератора:\n- " + g.warnings.join("\n- ") : "Генератор всё разместил."}${brief()}\n\n${KB.describe(S, { ascii: true, items: false, checks: false })}`); });
    case "auto_plan": return mutate(() => { const r = KB.autoPlan({ pkg: a.level || a.pkg || "M", w: +a.w, d: +a.d, h: +a.h || 4.5, mezz: a.mezz || "auto", name: a.name }); S = r.project;
      return text(`${r.brief}\n${r.log.length ? "Решения движка:\n- " + r.log.join("\n- ") : "Программа поместилась без изменений."}${r.warnings.length ? "\nЗамечания: " + r.warnings.join(" ") : ""}${r.missing.length ? "\nНе поместилось: " + r.missing.join(", ") : ""}${brief()}`); });
    case "compare_variants": { const vs = KB.variants({ w: +a.w, d: +a.d, h: +a.h || 4.5, mezz: a.mezz || "auto" });
      return text(vs.map(r => `${r.brief}${r.missing.length ? " Не поместилось: " + r.missing.join(", ") + "." : ""}\n  решения: ${r.log.slice(0, 8).join("; ") || "без изменений"}`).join("\n\n")); }
    case "blank_building": return mutate(() => { S = { v: 1, name: a.name || "Новый офис продаж", notes: "", b: { w: +a.w, d: +a.d, h: +a.h || 4.5, mz: 3.3, front: "vitrage" }, items: [] }; return text(`Пустое здание ${a.w}×${a.d} м.`); });
    case "add_room": return opRun("add_room", a);
    case "update_element": return opRun("update", a);
    case "delete_element": return opRun("delete", a);
    case "add_furniture": return opRun("add_item", a);
    case "furnish_room": return opRun("furnish", a);
    case "add_furniture_set": return opRun("add_set", a);
    case "clear_room": return opRun("clear", a);
    case "add_door": return opRun("add_door", a);
    case "add_wall": return opRun("add_wall", a);
    case "set_building": return opRun("building", a);
    case "set_floor": return opRun("floor", a);
    case "batch": return mutate(() => { const res = KB.applyAll(S, a.ops || [], !!a.atomic);
      return text(res.map((r, i) => `${i + 1}. ${r.ok ? "✓" : "✗"} ${r.op || ""}: ${r.msg}`).join("\n") + brief()); });
    case "find_free_space": { const r = KB.findSpace(S, a); return text(r.length ? r.map(p => `x ${p.x}, y ${p.y} (${p.w}×${p.h})`).join("\n") : "Свободного места такого размера нет."); }
    case "check_plan": return text(KB.summary(S));
    case "list_catalog": return text(KB.catalogText(a.group));
    case "planning_guide": return text(refs[a.topic] || `Нет раздела «${a.topic}». Есть: ${Object.keys(refs).join(", ")}`);
    case "undo": { if (!hist.length) return text("Нечего отменять."); fut.push(JSON.stringify(S)); S = JSON.parse(hist.pop()); changed("claude"); return text("Отменено." + brief()); }
    case "redo": { if (!fut.length) return text("Нечего возвращать."); hist.push(JSON.stringify(S)); S = JSON.parse(fut.pop()); changed("claude"); return text("Возвращено." + brief()); }
    case "save_project": { const f = fileOf(a.file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(S, null, 1)); return text(`Сохранено: ${f}\nОткрыть в планировщике: «Проекты» → «Открыть файл…».`); }
    case "open_project": {
      if (!a.file) { const list = fs.readdirSync(DATA).filter(f => f.endsWith(".json") && f !== "current.json"); return text(list.length ? `Проекты в ${DATA}:\n` + list.join("\n") : `В ${DATA} пока нет сохранённых проектов.`); }
      const f = fileOf(a.file); const P2 = JSON.parse(fs.readFileSync(f, "utf8")); if (!P2.b || !P2.items) throw new Error("это не файл проекта планировщика");
      return mutate(() => { S = P2; return text(`Открыт «${S.name}».` + brief()); });
    }
  }
  return err("Неизвестный инструмент " + name);
}

const INSTRUCTIONS = `Вы управляете «Планировщиком офиса продаж» (девелопер, офис продаж ЖК) — как Blender через MCP, только для планировок.
Координаты в метрах: X вдоль дороги (0 — левый торец), Y вглубь (0 — глухая задняя стена, Y = глубина здания — фасад с витражом и входом). Наружные стены 0,3 м.

Порядок работы:
1. open_planner (пользователь видит изменения вживую), затем describe_plan — что уже есть.
2. Новый офис: спросите размеры (длина вдоль улицы × глубина × высота) и вариант наполнения; compare_variants → покажите пользователю три варианта → auto_plan с выбранным (S Базовый — максимум мест продаж, M Стандарт — баланс, L Премиум — бар, детская, шоурум, медиа). Или blank_building и расстановка вручную.
3. Правки — add_room / update_element / delete_element / furnish_room / add_furniture; много правок — одним batch.
4. После правок: check_plan и view_plan — посмотрите картинку, исправьте наложения и тесноту.
5. Кратко расскажите пользователю, что сделали, какие остались замечания и вопросы к проектировщику.

Логика офиса продаж (коротко; подробно — planning_guide):
- Зоны по приватности: публичная у витража и входа (тамбур → ресепшен видно от входа → ожидание, макет, кофе, детская) → полупубличная вдоль глухой стены (кабинеты менеджеров со стеклом в зал, переговорные) → закрытая (сделочная/VIP, ипотека, касса) ближе к служебному блоку → служебная в торце (с/у, кухня, КУИ, щитовая, серверная), бэк-офис — в торце или на антресоли.
- Клиент никогда не идёт через служебные помещения. Проход вдоль кабинетов ≥ 1,5–1,8 м; ось входа свободна.
- Модули: кабинет 3,0×3,2; переговорная 4,5×3,2 (на 6); VIP 18–25 м²; с/у МГН ≥ 2,2×2,25; кухня ≥ max(12 м², 1 м²/чел) (в малом офисе 6 м²); макет = стол + 1,2 м обхода.
- Антресоль: только служебное, высота здания ≥ 6,2 м, ≤ 40% площади, ограждение, лестница.
- Нормы — мягкие подсказки; где не уверены — «сверить с проектировщиком». Это эскиз заказчика, не проект.
Названия помещений пишите стандартно («Кабинет менеджера», «Переговорная на 6», «С/у МГН», «Кухня персонала», «Бэк-офис», «Кабинет РОП») — по ним подбирается мебель и считается программа.`;

/* ------------------------------------------------------------ JSON-RPC по stdio */
function send(m) { process.stdout.write(JSON.stringify(m) + "\n"); }
async function handle(m) {
  const { id, method, params } = m;
  if (method === "initialize") return send({ jsonrpc: "2.0", id, result: { protocolVersion: (params && params.protocolVersion) || "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: "office-planner", title: "Планировщик офиса продаж", version: VERSION }, instructions: INSTRUCTIONS } });
  if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (method === "tools/call") { let r; try { r = await callTool(params.name, params.arguments || {}); } catch (e) { r = err("Ошибка: " + (e.message || e)); } return send({ jsonrpc: "2.0", id, result: r }); }
  if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
  if (method === "resources/list") return send({ jsonrpc: "2.0", id, result: { resources: [] } });
  if (method === "prompts/list") return send({ jsonrpc: "2.0", id, result: { prompts: [] } });
  if (id !== undefined && id !== null) send({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found: " + method } });
}
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", d => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
  let m; try { m = JSON.parse(line); } catch (e) { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
  Promise.resolve(handle(m)).catch(e => log(e.stack || e)); } });
process.stdin.on("end", () => { if (process.env.OFFICE_PLANNER_STAY) return; setTimeout(() => process.exit(0), 200); });
module.exports = { callTool, get S() { return S; } };
