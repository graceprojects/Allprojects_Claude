#!/usr/bin/env node
/* Проверка зонирования офиса продаж по правилам из реальных проектов houz architects.
 *   node zoning_check.js project.json        — план из houz planner (JSON)
 * Печатает: здание и тип (линейный / компактный), оценку плана (KB.planScore), путь клиента по этапам CJM (KB.journey),
 * матрицу смежности (KB.adjacency), нормы (KB.checks) и советы по планировке (KB.designChecks).
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
const norms = KB.checks(S), design = KB.designChecks(S), P = KB.planScore(S), J = KB.journey(S), A = KB.adjacency(S);
console.log(`\nОценка плана: ${P.score} из 100 (нормы −${P.parts.norms}, программа −${P.parts.lost}, зонирование −${P.parts.zoning}, смежность ${P.adj} %)`);
if (J) { console.log("\nПуть клиента (CJM), по проходам от входной двери:");
  for (const st of J.stages) console.log(`  ${st.n}. ${st.label}: ${st.missing ? "—" : `${st.room.name} · ${st.dist == null ? "нет прохода" : st.dist + " м"}${st.transit ? " · ТОЛЬКО ЧЕРЕЗ ЗАКРЫТЫЕ КОМНАТЫ" : ""}${st.via.length ? " · через " + st.via.map(r => r.name).join(" → ") : ""}`}`);
  console.log(`  с порога видно: стойку — ${J.see.rec === false ? "нет" : "да"}, макет — ${J.see.maket === false ? "нет" : "да"}${J.staff ? `; персонал: служебный вход → ${J.staff.room.name} ${J.staff.dist} м${J.staff.crosses.length ? " через " + J.staff.crosses.map(r => r.name).join(", ") : ""}` : ""}`); }
else console.log("\nПуть клиента: не найден вход (дверь с подписью «Вход» на витраже).");
console.log("\nМатрица смежности:"); for (const p of A.pairs) console.log(`  ${p.ok ? "✓" : "✗"} ${p.ra.pseudo ? "вход" : p.ra.name} — ${p.rb.pseudo ? "вход" : p.rb.name}: ${p.dist} м (${p.rel === "avoid" ? "≥" : "≤"} ${p.d}) · ${p.why}`);
console.log(`\nНормы (СП): ${norms.length ? "" : "замечаний нет"}`); for (const c of norms) console.log(`  [${c.level}] ${c.text}`);
console.log(`\nПланировка (как в проектах houz): ${design.length ? "" : "замечаний нет"}`); for (const c of design) console.log(`  [совет · ${c.key}] ${c.text}`);
process.exit(norms.some(c => c.level === "red") ? 2 : 0);
