#!/usr/bin/env node
/* Проверка зонирования офиса продаж по правилам из реальных проектов houz architects.
 *   node zoning_check.js project.json        — план из houz planner (JSON)
 * Печатает: здание и тип (линейный / компактный), нормы (KB.checks) и советы по планировке (KB.designChecks).
 * Геометрия плана: витраж и главный вход — сторона y = d, глухая стена — y = 0.
 */
const fs = require("fs"), path = require("path");
const KB = require(path.join(__dirname, "office-kb.js"));
const f = process.argv[2];
if (!f) { console.error("node zoning_check.js project.json"); process.exit(1); }
const S = JSON.parse(fs.readFileSync(f, "utf8"));
if (!S.b || !Array.isArray(S.items)) { console.error("Это не файл проекта планировщика (нет b / items)."); process.exit(1); }
const W = +S.b.w, D = +S.b.d, r = W / D;
const type = r >= 2.5 ? "линейный (длинный фасад вдоль улицы)" : r <= 1.5 ? "компактный (глубокий зал)" : "промежуточный";
const rooms = S.items.filter(i => i.t === "room");
console.log(`${S.name}\nЗдание ${W} × ${D} м, W/D = ${r.toFixed(2)} → ${type}; помещений ${rooms.length}, уровней ${new Set(rooms.map(i => i.lv || 0)).size}`);
const norms = KB.checks(S), design = KB.designChecks(S);
console.log(`\nНормы (СП): ${norms.length ? "" : "замечаний нет"}`); for (const c of norms) console.log(`  [${c.level}] ${c.text}`);
console.log(`\nПланировка (как в проектах houz): ${design.length ? "" : "замечаний нет"}`); for (const c of design) console.log(`  [совет · ${c.key}] ${c.text}`);
process.exit(norms.some(c => c.level === "red") ? 2 : 0);
